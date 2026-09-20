/**
 * AI Disaster Logistics Controller - Multi-Dashboard Router Edition
 * Minimalist White Architecture
 */

// Tactical Web Audio API Synthesizer
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
        this.playBeep(880, 'triangle', 0.2);
        setTimeout(() => this.playBeep(587.33, 'triangle', 0.25), 180);
    },
    playSuccessChime() {
        this.playBeep(523.25, 'sine', 0.12);
        setTimeout(() => this.playBeep(659.25, 'sine', 0.12), 120);
        setTimeout(() => this.playBeep(783.99, 'sine', 0.25), 240);
    },
    playLoRaChirp() {
        this.playBeep(1200, 'sine', 0.08);
        setTimeout(() => this.playBeep(1600, 'sine', 0.08), 80);
    }
};

const App = {
    state: null,
    currentDashboard: 'admin',

    async init() {
        this.setupRouter();
        await this.fetchStatus();
        DriverSim.init();
        this.setupForms();
        this.startClock();
    },

    setupRouter() {
        // Handle hash navigation
        const handleHash = () => {
            const hash = window.location.hash.replace('#', '');
            if (['admin', 'officer', 'inventory', 'allocation', 'driver'].includes(hash)) {
                this.switchDashboard(hash, false);
            } else {
                this.switchDashboard('admin', false);
            }
        };

        window.addEventListener('hashchange', handleHash);
        handleHash();
    },

    switchDashboard(name, updateHash = true) {
        this.currentDashboard = name;
        if (updateHash) {
            window.location.hash = name;
        }

        // Update nav button states
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            if (btn.dataset.tab === name) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Hide all dashboard views
        document.querySelectorAll('.dashboard-view').forEach(view => {
            view.classList.add('hidden');
        });

        // Show active dashboard view
        const targetView = document.getElementById(`view-${name}`);
        if (targetView) {
            targetView.classList.remove('hidden');
        }

        // Leaflet map refresh when returning to map-containing views
        if (name === 'admin') {
            setTimeout(() => {
                if (disasterMap) {
                    disasterMap.invalidateSize();
                }
            }, 100);
        }
    },

    async fetchStatus() {
        try {
            const res = await fetch('/api/status');
            if (!res.ok) throw new Error("Static mode");
            const data = await res.json();
            this.state = data;
        } catch (err) {
            // Standalone GitHub Pages Mode (zero backend required)
            const saved = localStorage.getItem('disaster_hub_state');
            if (saved) {
                this.state = JSON.parse(saved);
            } else {
                this.state = {
                    hub: {
                        id: "HUB-01",
                        name: "State Disaster Operations Center (Main Hub)",
                        lat: 30.1450,
                        lon: 78.7800,
                        contact: "+91-1800-DISASTER",
                        status: "ACTIVE_COMMAND"
                    },
                    inventory: {
                        ambulances: { total: 3, allocated: 0, available: 3 },
                        trucks: { total: 5, allocated: 0, available: 5 },
                        boats: { total: 3, allocated: 0, available: 3 },
                        jcbs: { total: 2, allocated: 0, available: 2 },
                        small_vehicles: { total: 4, allocated: 0, available: 4 },
                        food_packs: { total: 1200, allocated: 0, available: 1200 },
                        medicines: { total: 850, allocated: 0, available: 850 },
                        water_liters: { total: 5000, allocated: 0, available: 5000 },
                        tents: { total: 200, allocated: 0, available: 200 }
                    },
                    locations: [
                        {
                            id: "LOC-A",
                            name: "Location A (Flooded Town - Rudra Valley)",
                            lat: 30.2850,
                            lon: 78.9800,
                            condition: "Flooded Area & Bridge Stress",
                            affected_people: 650,
                            medical_urgency: 9,
                            road_condition: "Flooded / Blocked Bridges",
                            communication_mode: "Cellular 4G",
                            demand: { ambulances: 2, food_packs: 400, medicines: 300, water_liters: 2000, boats: 2, tents: 50 },
                            reported_at: "10 mins ago"
                        },
                        {
                            id: "LOC-B",
                            name: "Location B (Flooded Valley - Chamoli East)",
                            lat: 30.3400,
                            lon: 79.1500,
                            condition: "Flash Flood & Water Inundation",
                            affected_people: 320,
                            medical_urgency: 6,
                            road_condition: "Partially Submerged / Narrow Roads",
                            communication_mode: "LoRa Gateway (Remote)",
                            lora_metadata: { freq_mhz: 868.1, rssi_dbm: -108, snr_db: 6.8, raw_hex: "4C4F43423A464C4F4F443A504F50333230" },
                            demand: { ambulances: 2, food_packs: 250, medicines: 180, water_liters: 1200, boats: 1, tents: 80 },
                            reported_at: "18 mins ago"
                        }
                    ],
                    hazards: [
                        {
                            id: "HAZ-01",
                            name: "Major Landslide - Hill Pass Road",
                            lat: 30.2200,
                            lon: 78.8900,
                            type: "Landslide (Blocked Road)",
                            severity: "CRITICAL_BLOCKAGE",
                            affected_route: "Route 3",
                            clearing_equipment: "JCB / Excavator",
                            is_cleared: false
                        }
                    ],
                    routes: [
                        {
                            id: "ROUTE-1",
                            name: "Route 1 (Primary - Safer Ridge Corridor)",
                            priority: 1,
                            status: "RECOMMENDED",
                            description: "Highest Priority, safe elevated road, bypasses flood plain",
                            distance_km: 34.2,
                            estimated_time_min: 52,
                            risk_score: 14,
                            color: "#059669",
                            path: [[30.1450, 78.7800], [30.1720, 78.8150], [30.2100, 78.8600], [30.2450, 78.9100], [30.2700, 78.9500], [30.2850, 78.9800]]
                        },
                        {
                            id: "ROUTE-2",
                            name: "Route 2 (Alternative - Valley Bypass)",
                            priority: 2,
                            status: "ALTERNATIVE",
                            description: "Secondary safe option with slight gravel roughness",
                            distance_km: 41.5,
                            estimated_time_min: 68,
                            risk_score: 38,
                            color: "#d97706",
                            path: [[30.1450, 78.7800], [30.1600, 78.7500], [30.1950, 78.7900], [30.2300, 78.8500], [30.2650, 78.9300], [30.2850, 78.9800]]
                        },
                        {
                            id: "ROUTE-3",
                            name: "Route 3 (Secondary Option - Currently Blocked)",
                            priority: 3,
                            status: "BLOCKED",
                            description: "Direct river gorge highway - BLOCKED by active landslide at Km 22",
                            distance_km: 28.0,
                            estimated_time_min: 0,
                            risk_score: 96,
                            color: "#ef4444",
                            is_blocked: true,
                            block_point: [30.2200, 78.8900],
                            path: [[30.1450, 78.7800], [30.1800, 78.8300], [30.2200, 78.8900], [30.2500, 78.9400], [30.2850, 78.9800]]
                        }
                    ],
                    deliveries: [
                        { id: "DEL-101", vehicle: "Emergency Ambulance AMB-01", destination: "Location A (Flooded Town)", route: "Route 1 (Primary)", status: "EN_ROUTE", cargo: "Trauma kits & 2 Paramedics", eta_min: 18 }
                    ],
                    driver_logs: [
                        { time: "19:35", event: "Main Hub dispatched AMB-01 via Route 1 (Safe Corridor)" },
                        { time: "19:38", event: "LoRa Packet RX: Location B confirmed battery backup online" },
                        { time: "19:42", event: "Driver AMB-01 cached offline GIS vector map" }
                    ]
                };
            }
        }
        this.renderAll();
    },

    renderAll() {
        if (!this.state) return;

        // 1. Render Admin Dashboard
        this.renderAdminView();

        // 2. Render Officer View
        this.renderOfficerView();

        // 3. Render Inventory View
        this.renderInventoryView();

        // 4. Render Allocation View
        this.renderAllocationView();

        // 5. Render Driver View
        DriverSim.renderDriverTerminal();
    },

    renderAdminView() {
        // KPIs
        const totalPeople = this.state.locations.reduce((acc, loc) => acc + (loc.affected_people || 0), 0);
        document.getElementById('adminTotalAffected').textContent = totalPeople.toLocaleString();
        document.getElementById('adminActiveReports').textContent = this.state.locations.length;
        
        const openRoutes = this.state.routes.filter(r => !r.is_blocked && r.status !== "BLOCKED").length;
        document.getElementById('adminSafeRoutes').textContent = `${openRoutes} / ${this.state.routes.length}`;

        const amb = this.state.inventory.ambulances;
        document.getElementById('adminAmbulances').textContent = `${amb.available} / ${amb.total}`;

        // Map
        initDisasterMap(this.state.hub, this.state.locations, this.state.routes, this.state.hazards);
        const primeRoute = this.state.routes.find(r => r.id === "ROUTE-1");
        if (primeRoute && !primeRoute.is_blocked) {
            startVehicleMovementSimulation(primeRoute.path, "AMB-01 (Ambulance)", "#059669");
        }

        // Pending Emergencies Table
        const tableBody = document.getElementById('adminEmergenciesTableBody');
        if (tableBody) {
            tableBody.innerHTML = this.state.locations.map(loc => {
                const ai = AIEngine.calculateSeverity(loc);
                const isLoRa = loc.communication_mode?.toLowerCase().includes("lora");

                return `
                    <tr class="hover:bg-slate-50 transition border-b border-slate-100 text-xs">
                        <td class="py-3 px-4 font-semibold text-slate-900">${loc.name}</td>
                        <td class="py-3 px-4">
                            <span class="px-2 py-0.5 rounded-full font-semibold font-mono text-[11px] ${ai.tierClass}">
                                ${ai.score}/100 • ${ai.tier.split(' ')[0]}
                            </span>
                        </td>
                        <td class="py-3 px-4 text-slate-600">${loc.condition}</td>
                        <td class="py-3 px-4 font-mono font-medium text-slate-800">${loc.affected_people} civilians</td>
                        <td class="py-3 px-4 text-slate-600">
                            ${isLoRa ? '<span class="text-cyan-700 font-mono"><i class="fas fa-tower-broadcast mr-1"></i> LoRa 868MHz</span>' : '<span class="text-emerald-700"><i class="fas fa-signal mr-1"></i> 4G Cell</span>'}
                        </td>
                        <td class="py-3 px-4 text-right">
                            <button onclick="App.switchDashboard('allocation')" 
                                class="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] transition">
                                View Allocation <i class="fas fa-arrow-right ml-1"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Logs
        const logsContainer = document.getElementById('adminLogsFeed');
        if (logsContainer) {
            logsContainer.innerHTML = this.state.driver_logs.map(log => `
                <div class="py-1.5 border-b border-slate-100 flex items-start space-x-2 text-xs">
                    <span class="text-slate-400 font-mono text-[11px] shrink-0">[${log.time}]</span>
                    <span class="text-slate-700">${log.event}</span>
                </div>
            `).join('');
        }
    },

    renderOfficerView() {
        const historyContainer = document.getElementById('officerReportsHistory');
        if (!historyContainer) return;

        historyContainer.innerHTML = this.state.locations.map(loc => {
            const ai = AIEngine.calculateSeverity(loc);
            const isLoRa = loc.communication_mode?.toLowerCase().includes("lora");

            return `
                <div class="white-card p-4 space-y-2">
                    <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                        <h4 class="font-bold text-sm text-slate-900">${loc.name}</h4>
                        <span class="text-xs px-2 py-0.5 rounded-full font-semibold font-mono ${ai.tierClass}">${ai.score}/100</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div><strong>Situation:</strong> ${loc.condition}</div>
                        <div><strong>Road Access:</strong> ${loc.road_condition}</div>
                        <div><strong>Civilians:</strong> ${loc.affected_people}</div>
                        <div><strong>Urgency:</strong> ${loc.medical_urgency}/10</div>
                    </div>
                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span class="text-slate-500 font-mono">
                            ${isLoRa ? '<i class="fas fa-tower-broadcast text-cyan-600 mr-1"></i> LoRa Gateway Ingest' : '<i class="fas fa-signal text-emerald-600 mr-1"></i> Cellular 4G'}
                        </span>
                        <span class="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Hub Ingested</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderInventoryView() {
        const inv = this.state.inventory;
        const container = document.getElementById('inventoryCardsContainer');
        if (!container) return;

        const items = [
            { key: "ambulances", label: "Emergency Ambulances", val: inv.ambulances, icon: "fa-truck-medical", color: "text-red-600", unit: "vehicles" },
            { key: "trucks", label: "Heavy Supply Trucks", val: inv.trucks, icon: "fa-truck-moving", color: "text-amber-600", unit: "vehicles" },
            { key: "boats", label: "Rescue Boats", val: inv.boats, icon: "fa-ship", color: "text-cyan-600", unit: "crafts" },
            { key: "jcbs", label: "JCBs / Excavators", val: inv.jcbs, icon: "fa-trowel-bricks", color: "text-yellow-600", unit: "heavy units" },
            { key: "small_vehicles", label: "4x4 Recon Vehicles", val: inv.small_vehicles, icon: "fa-car-side", color: "text-emerald-600", unit: "vehicles" },
            { key: "food_packs", label: "Food & Ration Packs", val: inv.food_packs, icon: "fa-box-tissue", color: "text-orange-600", unit: "packs" },
            { key: "medicines", label: "Trauma Medicine Kits", val: inv.medicines, icon: "fa-pills", color: "text-purple-600", unit: "kits" },
            { key: "water_liters", label: "Potable Clean Water", val: inv.water_liters, icon: "fa-faucet-drip", color: "text-blue-600", unit: "liters" },
            { key: "tents", label: "Emergency Shelters / Tents", val: inv.tents, icon: "fa-campground", color: "text-teal-600", unit: "tents" }
        ];

        container.innerHTML = items.map(item => `
            <div class="white-card p-4 flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                        <i class="fas ${item.icon} ${item.color} text-lg"></i>
                    </div>
                    <div>
                        <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">${item.label}</div>
                        <div class="text-xl font-bold font-mono text-slate-900 mt-0.5">
                            ${item.val.available} <span class="text-xs font-normal text-slate-400">/ ${item.val.total} ${item.unit}</span>
                        </div>
                    </div>
                </div>
                <span class="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono font-semibold">
                    READY
                </span>
            </div>
        `).join('');

        // Populate update form inputs
        const form = document.getElementById('inventoryUpdateForm');
        if (form && !form.dataset.initialized) {
            form.dataset.initialized = "true";
            form.innerHTML = `
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                        <label class="block font-medium text-slate-700 mb-1">Ambulances</label>
                        <input type="number" id="inputInvAmbulances" value="${inv.ambulances.total}" min="0" 
                            class="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block font-medium text-slate-700 mb-1">Supply Trucks</label>
                        <input type="number" id="inputInvTrucks" value="${inv.trucks.total}" min="0" 
                            class="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block font-medium text-slate-700 mb-1">Rescue Boats</label>
                        <input type="number" id="inputInvBoats" value="${inv.boats.total}" min="0" 
                            class="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block font-medium text-slate-700 mb-1">JCBs / Excavators</label>
                        <input type="number" id="inputInvJcbs" value="${inv.jcbs.total}" min="0" 
                            class="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block font-medium text-slate-700 mb-1">Food Packs</label>
                        <input type="number" id="inputInvFood" value="${inv.food_packs.total}" min="0" step="50" 
                            class="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block font-medium text-slate-700 mb-1">Medical Kits</label>
                        <input type="number" id="inputInvMeds" value="${inv.medicines.total}" min="0" step="25" 
                            class="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block font-medium text-slate-700 mb-1">Clean Water (L)</label>
                        <input type="number" id="inputInvWater" value="${inv.water_liters.total}" min="0" step="200" 
                            class="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block font-medium text-slate-700 mb-1">Shelter Tents</label>
                        <input type="number" id="inputInvTents" value="${inv.tents.total}" min="0" step="10" 
                            class="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-500">
                    </div>
                </div>
                <div class="mt-4 flex justify-end">
                    <button type="submit" 
                        class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm flex items-center space-x-2">
                        <i class="fas fa-save"></i>
                        <span>Update Hub Inventory</span>
                    </button>
                </div>
            `;
        }
    },

    renderAllocationView() {
        if (!this.state.locations || this.state.locations.length === 0) return;

        // Take primary location for AI breakdown
        const locA = this.state.locations[0];
        const aiA = AIEngine.calculateSeverity(locA);

        AIEngine.renderGauge(aiA.score, 'mainAIGauge');

        document.getElementById('aiLocationName').textContent = locA.name;
        document.getElementById('aiPriorityBadge').textContent = aiA.tier;
        document.getElementById('aiPriorityBadge').className = `text-xs px-2.5 py-0.5 rounded-full font-semibold font-mono ${aiA.tierClass}`;
        document.getElementById('aiExplanation').textContent = aiA.explanation;

        document.getElementById('barUrgency').style.width = `${aiA.features.medical_urgency}%`;
        document.getElementById('valUrgency').textContent = `${aiA.features.medical_urgency}%`;

        document.getElementById('barHazard').style.width = `${aiA.features.hazard_intensity}%`;
        document.getElementById('valHazard').textContent = `${aiA.features.hazard_intensity}%`;

        document.getElementById('barPop').style.width = `${aiA.features.population_vulnerability}%`;
        document.getElementById('valPop').textContent = `${aiA.features.population_vulnerability}%`;

        document.getElementById('barIsolation').style.width = `${aiA.features.isolation_penalty}%`;
        document.getElementById('valIsolation').textContent = `${aiA.features.isolation_penalty}%`;

        // Solve and render OR-Tools allocation cards
        const optResults = Optimizer.solve(this.state.locations, this.state.inventory);
        Optimizer.renderAllocationCards('optimizerCardsContainer', optResults);
    },

    setupForms() {
        // Field Officer report form
        const officerForm = document.getElementById('fieldReportForm');
        if (officerForm) {
            officerForm.addEventListener('submit', async (e) => {
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
                    
                    DriverSim.showToast(`Report from ${payload.name} ingested to Hub! AI Severity scored at ${result.ai_score.severity_score}/100.`, 'success');
                    officerForm.reset();
                    await this.fetchStatus();
                } catch (err) {
                    console.error("Submission failed", err);
                }
            });
        }

        // Inventory update form
        const invForm = document.getElementById('inventoryUpdateForm');
        if (invForm) {
            invForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                AudioController.playSuccessChime();

                const payload = {
                    ambulances: document.getElementById('inputInvAmbulances').value,
                    trucks: document.getElementById('inputInvTrucks').value,
                    boats: document.getElementById('inputInvBoats').value,
                    jcbs: document.getElementById('inputInvJcbs').value,
                    food_packs: document.getElementById('inputInvFood').value,
                    medicines: document.getElementById('inputInvMeds').value,
                    water_liters: document.getElementById('inputInvWater').value,
                    tents: document.getElementById('inputInvTents').value
                };

                try {
                    const res = await fetch('/api/inventory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    DriverSim.showToast('Central Hub inventory stocks updated successfully!', 'success');
                    await this.fetchStatus();
                } catch (err) {
                    console.error("Inventory update failed", err);
                }
            });
        }
    },

    useCurrentLocation() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                document.getElementById('inputLat').value = pos.coords.latitude.toFixed(4);
                document.getElementById('inputLon').value = pos.coords.longitude.toFixed(4);
                DriverSim.showToast(`GPS Position acquired: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, 'info');
            }, () => {
                DriverSim.showToast(`Using default mountain disaster coordinates.`, 'info');
            });
        }
    },

    async resetSimulation() {
        AudioController.playBeep(440, 'sine', 0.2);
        await fetch('/api/reset', { method: 'POST' });
        await this.fetchStatus();
        DriverSim.init();
        DriverSim.showToast('Disaster simulation scenario reset to initial state.', 'info');
    },

    addLog(msg) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        this.state.driver_logs.unshift({ time: timeStr, event: msg });
        this.renderAdminView();
    },

    startClock() {
        setInterval(() => {
            const timeEl = document.getElementById('navClock');
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
