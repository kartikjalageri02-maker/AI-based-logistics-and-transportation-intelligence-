/**
 * Main Disaster Logistics Controller & Audio Synthesizer
 */

// Web Audio API Synthesizer for tactical sounds
const AudioController = {
    ctx: null,
    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
    },
    playBeep(freq = 800, type = 'sine', duration = 0.15) {
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    },
    playHazardAlert() {
        this.playBeep(900, 'sawtooth', 0.2);
        setTimeout(() => this.playBeep(650, 'sawtooth', 0.3), 180);
    },
    playSuccessChime() {
        this.playBeep(523.25, 'sine', 0.12);
        setTimeout(() => this.playBeep(659.25, 'sine', 0.12), 120);
        setTimeout(() => this.playBeep(783.99, 'sine', 0.25), 240);
    },
    playLoRaChirp() {
        this.playBeep(1200, 'square', 0.08);
        setTimeout(() => this.playBeep(1800, 'square', 0.08), 90);
    }
};

const App = {
    state: null,
    activeTab: 'mapView',

    async init() {
        await this.fetchStatus();
        DriverSim.init();
        this.setupEventListeners();
        this.startTelemetryTicker();
    },

    async fetchStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            this.state = data;
            this.renderAll();
        } catch (err) {
            console.error("Failed to load status", err);
        }
    },

    renderAll() {
        if (!this.state) return;

        // 1. Render Map & Routes
        initDisasterMap(this.state.hub, this.state.locations, this.state.routes, this.state.hazards);
        
        // Start animated vehicle along primary route
        const primeRoute = this.state.routes.find(r => r.id === "ROUTE-1");
        if (primeRoute && !primeRoute.is_blocked) {
            startVehicleMovementSimulation(primeRoute.path, "AMB-01 (Ambulance)", "#10b981");
        }

        // 2. Render KPI Stats
        this.renderKPIs();

        // 3. Render AI Severity Engine
        this.renderAISection();

        // 4. Render Optimization
        this.runOptimization();

        // 5. Render Locations List
        this.renderLocationsList();

        // 6. Render LoRa Terminal
        this.renderLoRaTerminal();

        // 7. Render Logs
        this.renderActivityLogs();
    },

    renderKPIs() {
        const totalPeople = this.state.locations.reduce((acc, loc) => acc + (loc.affected_people || 0), 0);
        document.getElementById('statTotalAffected').textContent = totalPeople.toLocaleString();
        document.getElementById('statActiveReports').textContent = this.state.locations.length;
        
        const openRoutes = this.state.routes.filter(r => !r.is_blocked && r.status !== "BLOCKED").length;
        document.getElementById('statSafeRoutes').textContent = `${openRoutes} / ${this.state.routes.length}`;

        const amb = this.state.inventory.ambulances;
        document.getElementById('statAmbulances').textContent = `${amb.available} / ${amb.total}`;
    },

    renderAISection() {
        if (!this.state.locations || this.state.locations.length === 0) return;

        // Take the highest severity location for gauge display
        const locA = this.state.locations[0];
        const aiA = AIEngine.calculateSeverity(locA);
        
        AIEngine.renderGauge(aiA.score, 'mainAIGauge');
        
        document.getElementById('aiLocationName').textContent = locA.name;
        document.getElementById('aiPriorityBadge').textContent = aiA.tier;
        document.getElementById('aiPriorityBadge').className = `text-xs px-2 py-0.5 rounded font-mono ${aiA.tierClass}`;
        document.getElementById('aiExplanation').textContent = aiA.explanation;

        // Breakdown bars
        document.getElementById('barUrgency').style.width = `${aiA.features.medical_urgency}%`;
        document.getElementById('valUrgency').textContent = `${aiA.features.medical_urgency}%`;

        document.getElementById('barHazard').style.width = `${aiA.features.hazard_intensity}%`;
        document.getElementById('valHazard').textContent = `${aiA.features.hazard_intensity}%`;

        document.getElementById('barPop').style.width = `${aiA.features.population_vulnerability}%`;
        document.getElementById('valPop').textContent = `${aiA.features.population_vulnerability}%`;

        document.getElementById('barIsolation').style.width = `${aiA.features.isolation_penalty}%`;
        document.getElementById('valIsolation').textContent = `${aiA.features.isolation_penalty}%`;
    },

    runOptimization() {
        const optResults = Optimizer.solve(this.state.locations, this.state.inventory);
        Optimizer.renderAllocationCards('optimizerCardsContainer', optResults);
    },

    renderLocationsList() {
        const container = document.getElementById('fieldReportsContainer');
        if (!container) return;

        container.innerHTML = this.state.locations.map(loc => {
            const isLoRa = loc.communication_mode?.toLowerCase().includes("lora");
            const ai = AIEngine.calculateSeverity(loc);

            return `
                <div class="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 hover:border-blue-500/50 transition">
                    <div class="flex items-center justify-between">
                        <div class="font-bold text-sm text-white">${loc.name}</div>
                        <span class="text-xs px-2 py-0.5 rounded font-mono ${ai.tierClass}">${ai.score}/100</span>
                    </div>
                    <div class="text-xs text-slate-300 mt-1 flex items-center space-x-3">
                        <span><i class="fas fa-users text-blue-400 mr-1"></i> ${loc.affected_people} Affected</span>
                        <span><i class="fas fa-heart-pulse text-red-400 mr-1"></i> Urgency: ${loc.medical_urgency}/10</span>
                    </div>
                    <div class="text-xs text-slate-400 mt-1">
                        <i class="fas fa-road text-amber-400 mr-1"></i> ${loc.road_condition}
                    </div>
                    <div class="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-700/50">
                        <span class="font-mono text-slate-400">
                            ${isLoRa ? '<i class="fas fa-tower-broadcast text-cyan-400 mr-1"></i> LoRa Gateway (868MHz)' : '<i class="fas fa-signal text-emerald-400 mr-1"></i> Cellular 4G/5G'}
                        </span>
                        <span class="text-slate-500">${loc.reported_at || 'Live'}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderLoRaTerminal() {
        const container = document.getElementById('loraTerminalContent');
        if (!container) return;

        const loraLoc = this.state.locations.find(l => l.communication_mode?.toLowerCase().includes("lora"));
        if (loraLoc && loraLoc.lora_metadata) {
            const meta = loraLoc.lora_metadata;
            container.innerHTML = `
                <div class="space-y-1.5 font-mono text-[11px]">
                    <div class="text-cyan-400"><i class="fas fa-satellite-dish mr-1"></i> [LoRaWAN GW-EAST-CHAMOLI] RX PACKET OK</div>
                    <div class="text-slate-400">FREQ: <span class="text-white">${meta.freq_mhz} MHz</span> | RSSI: <span class="text-emerald-400">${meta.rssi_dbm} dBm</span> | SNR: <span class="text-emerald-400">${meta.snr_db} dB</span></div>
                    <div class="p-2 rounded bg-slate-950 text-emerald-400 break-all border border-slate-800">
                        RAW_HEX: ${meta.raw_hex}
                    </div>
                    <div class="text-slate-300">
                        DECODED: <span class="text-blue-300">Payload valid from ${loraLoc.name}. Medical urgency index 6, 320 civilians isolated, zero cellular tower coverage.</span>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `<div class="text-xs text-slate-500 font-mono">Listening on 868.1 MHz ISM band...</div>`;
        }
    },

    renderActivityLogs() {
        const container = document.getElementById('logsContainer');
        if (!container) return;

        container.innerHTML = this.state.driver_logs.map(log => `
            <div class="text-xs font-mono py-1.5 border-b border-slate-800 flex items-start space-x-2">
                <span class="text-slate-500 shrink-0">[${log.time}]</span>
                <span class="text-slate-300">${log.event}</span>
            </div>
        `).join('');
    },

    addLog(msg) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        this.state.driver_logs.unshift({ time: timeStr, event: msg });
        this.renderActivityLogs();
    },

    setupEventListeners() {
        // Field Assessment Form submit
        const form = document.getElementById('fieldReportForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                AudioController.playLoRaChirp();

                const payload = {
                    name: document.getElementById('inputLocName').value,
                    lat: parseFloat(document.getElementById('inputLat').value),
                    lon: parseFloat(document.getElementById('inputLon').value),
                    condition: document.getElementById('inputCondition').value,
                    affected_people: parseInt(document.getElementById('inputPeople').value),
                    medical_urgency: parseInt(document.getElementById('inputUrgency').value),
                    road_condition: document.getElementById('inputRoad').value,
                    communication_mode: document.getElementById('inputComm').value,
                    req_ambulances: parseInt(document.getElementById('inputReqAmb').value),
                    req_food: parseInt(document.getElementById('inputReqFood').value)
                };

                try {
                    const res = await fetch('/api/report', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();
                    
                    DriverSim.showToast(`Report Received from ${payload.name}! Central Hub AI re-evaluating priority ranking.`, 'info');
                    form.reset();
                    await this.fetchStatus();
                } catch (err) {
                    console.error("Submission failed", err);
                }
            });
        }
    },

    async resetSimulation() {
        AudioController.playBeep(400, 'sine', 0.2);
        await fetch('/api/reset', { method: 'POST' });
        await this.fetchStatus();
        DriverSim.init();
        DriverSim.showToast('Disaster simulation scenario reset to default state.', 'info');
    },

    startTelemetryTicker() {
        setInterval(() => {
            const timeEl = document.getElementById('utcClock');
            if (timeEl) {
                const d = new Date();
                timeEl.textContent = d.toLocaleTimeString() + " (IST)";
            }
        }, 1000);
    }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
