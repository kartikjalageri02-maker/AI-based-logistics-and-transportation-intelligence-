/**
 * Driver Guidance, In-Cab Tactical Navigation & Emergency Telemetry
 * Modern Enterprise Edition
 */

const DriverSim = {
    activeVehicle: "Ambulance AMB-01",
    activeRouteId: "ROUTE-1",
    activeRoute: "Route 1 (Primary - Safe Ridge)",
    voiceEnabled: true,
    isOffline: false,
    
    // In-cab live telemetry
    telemetry: {
        speedKmH: 42,
        altitudeM: 1840,
        heading: "NE 45°",
        distanceCoveredKm: 19.2,
        totalDistanceKm: 34.2,
        etaMin: 18,
        engineStatus: "OPTIMAL"
    },

    // Cargo Manifest Checklist
    manifest: [
        { item: "Trauma Emergency Medical Packs (12 kits)", checked: true },
        { item: "Portable Oxygen Cylinders (2 units)", checked: true },
        { item: "Emergency Clean Drinking Water (2,000 L)", checked: true },
        { item: "Pediatric Antibiotics & IV Fluids (40 units)", checked: true },
        { item: "LoRa 868MHz Satellite Radio Transceiver (1 unit)", checked: false }
    ],

    // Turn-by-turn guidance steps
    navSteps: [
        { km: "0.0 km", instruction: "Depart State Disaster Operations Center (Main Hub)", status: "COMPLETED", icon: "fa-flag-checkered" },
        { km: "8.4 km", instruction: "Cross River Bypass Bridge - Speed limit 45 km/h", status: "COMPLETED", icon: "fa-bridge" },
        { km: "19.2 km", instruction: "Ridge Elevation Corridor - Road Safe & Clear of Flooding", status: "CURRENT", icon: "fa-road" },
        { km: "28.5 km", instruction: "Approaching Sector A Triage Checkpoint", status: "PENDING", icon: "fa-shield-halved" },
        { km: "34.2 km", instruction: "Arrive at Flooded Town Relief Distribution Camp", status: "PENDING", icon: "fa-location-dot" }
    ],

    init() {
        this.renderDriverTerminal();
        this.startTelemetryInterval();
    },

    speak(text) {
        if (!this.voiceEnabled) return;
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.05;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) {}
    },

    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        this.renderDriverTerminal();
        if (this.voiceEnabled) {
            this.speak("Voice guidance enabled");
            this.showToast("🔊 Voice navigation audio enabled.", "info");
        } else {
            this.showToast("🔇 Voice navigation muted.", "info");
        }
    },

    switchCorridor(routeId) {
        this.activeRouteId = routeId;
        if (routeId === "ROUTE-1") {
            this.activeRoute = "Route 1 (Primary - Safe Ridge)";
            this.telemetry.totalDistanceKm = 34.2;
            this.telemetry.etaMin = 18;
            this.speak("Selected Route 1 Safe Ridge Corridor. ETA eighteen minutes.");
        } else {
            this.activeRoute = "Route 2 (Valley Bypass)";
            this.telemetry.totalDistanceKm = 41.5;
            this.telemetry.etaMin = 28;
            this.speak("Switched to Route 2 Valley Bypass. Distance forty-one kilometers.");
        }

        // Update animated vehicle path on Leaflet map if available
        if (window.App && window.App.state && typeof startVehicleMovementSimulation === 'function') {
            const selected = window.App.state.routes.find(r => r.id === routeId);
            if (selected) {
                startVehicleMovementSimulation(selected.path, this.activeVehicle, selected.color);
            }
        }

        this.renderDriverTerminal();
        this.showToast(`Switched active corridor to ${this.activeRoute}.`, "info");
    },

    toggleManifestItem(index) {
        if (this.manifest[index]) {
            this.manifest[index].checked = !this.manifest[index].checked;
            AudioController.playSuccessChime();
            this.renderDriverTerminal();
        }
    },

    downloadOfflineMap() {
        AudioController.playLoRaChirp();
        this.speak("Downloading offline vector map package.");

        const routes = (window.App && window.App.state) ? window.App.state.routes : [];
        const hub = (window.App && window.App.state) ? window.App.state.hub : {};
        const locations = (window.App && window.App.state) ? window.App.state.locations : [];

        const offlinePackage = {
            type: "FeatureCollection",
            metadata: {
                title: "Disaster Logistics Offline Navigation Package",
                generated_at: new Date().toISOString(),
                assigned_vehicle: this.activeVehicle,
                assigned_route: this.activeRoute,
                emergency_radio_channel: "LoRa 868.1 MHz / VHF 156.8 MHz",
                offline_mode: "STANDALONE_GPS_ENABLED",
                telemetry: this.telemetry
            },
            features: [
                {
                    type: "Feature",
                    properties: { name: hub.name || "Main Hub", role: "Dispatch Center" },
                    geometry: { type: "Point", coordinates: [hub.lon || 78.78, hub.lat || 30.145] }
                },
                ...locations.map(loc => ({
                    type: "Feature",
                    properties: { name: loc.name, condition: loc.condition, urgency: loc.medical_urgency },
                    geometry: { type: "Point", coordinates: [loc.lon, loc.lat] }
                })),
                ...routes.map(r => ({
                    type: "Feature",
                    properties: { name: r.name, status: r.status, risk: r.risk_score },
                    geometry: {
                        type: "LineString",
                        coordinates: r.path.map(p => [p[1], p[0]])
                    }
                }))
            ]
        };

        const jsonStr = JSON.stringify(offlinePackage, null, 2);
        const blob = new Blob([jsonStr], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `offline_map_${this.activeVehicle.replace(/\s+/g, '_')}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast(`📥 Offline Map Package downloaded successfully! Cached for zero-connectivity navigation.`, 'success');
        this.isOffline = true;
        this.renderDriverTerminal();
    },

    async reportHazard(hazardType = "Severe Landslide Blockage") {
        try {
            AudioController.playHazardAlert();
            this.speak(`Caution! Emergency hazard reported: ${hazardType}. Re-routing active fleet to bypass corridor.`);

            // Try backend API
            try {
                await fetch('/api/driver/incident', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        driver: this.activeVehicle,
                        route_id: this.activeRouteId,
                        type: hazardType,
                        coordinates: [30.21, 78.86]
                    })
                });
            } catch (netErr) {}

            // Handle client-side state update for GitHub Pages / static mode
            if (window.App && window.App.state) {
                const r1 = window.App.state.routes.find(r => r.id === "ROUTE-1");
                if (r1) {
                    r1.status = "BLOCKED";
                    r1.is_blocked = true;
                    r1.risk_score = 99;
                    r1.color = "#ef4444";
                    r1.description = `HAZARD REPORTED by ${this.activeVehicle}: ${hazardType}`;
                }
                const r2 = window.App.state.routes.find(r => r.id === "ROUTE-2");
                if (r2) {
                    r2.status = "RECOMMENDED (RE-ROUTED)";
                    r2.color = "#059669";
                }
                window.App.addLog(`⚠️ HAZARD REPORTED: ${this.activeVehicle} reported ${hazardType}. Central Hub dynamically rerouted fleet.`);
                window.App.saveState();
                window.App.renderAll();
            }

            // Automatically switch driver view to Route 2
            this.activeRouteId = "ROUTE-2";
            this.activeRoute = "Route 2 (Valley Bypass - Rerouted)";
            this.telemetry.totalDistanceKm = 41.5;
            this.telemetry.etaMin = 26;

            this.showToast(`⚠️ Hazard Broadcast Sent! Hub notified: Route 1 closed, diverted to Route 2 Bypass.`, 'danger');

            this.navSteps.splice(2, 0, {
                km: "21.0 km",
                instruction: `⚠️ ROAD CLOSED: ${hazardType}. Diverted to Route 2 Valley Bypass.`,
                status: "HAZARD",
                icon: "fa-triangle-exclamation"
            });
            this.renderDriverTerminal();

        } catch (err) {
            console.error("Failed to report incident", err);
        }
    },

    async confirmDelivery() {
        AudioController.playSuccessChime();
        this.speak("Relief supplies successfully delivered. Mission confirmed.");
        this.showToast(`✅ Relief delivery verified at Location A! Mission feedback recorded in Central Hub.`, 'success');
        
        this.navSteps.forEach(s => s.status = "COMPLETED");
        this.telemetry.speedKmH = 0;
        this.renderDriverTerminal();

        if (window.App) {
            window.App.addLog(`Driver ${this.activeVehicle} confirmed successful delivery of relief supplies at destination.`);
        }
    },

    startTelemetryInterval() {
        // Minor realistic fluctuation for speedometer & distance
        setInterval(() => {
            if (this.telemetry.speedKmH > 0) {
                const variance = (Math.random() * 4 - 2);
                this.telemetry.speedKmH = Math.max(25, Math.min(55, Math.round(42 + variance)));
                const speedEl = document.getElementById('driverHudSpeed');
                if (speedEl) speedEl.textContent = `${this.telemetry.speedKmH} km/h`;
            }
        }, 3000);
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bg = type === 'danger' 
            ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
            : (type === 'success' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-900 text-white shadow-lg shadow-slate-900/20');
        
        toast.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 transition-all transform duration-300 ${bg}`;
        toast.innerHTML = `
            <i class="fas ${type === 'danger' ? 'fa-triangle-exclamation' : (type === 'success' ? 'fa-circle-check' : 'fa-bell')} text-base"></i>
            <span class="text-xs font-semibold">${message}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    renderDriverTerminal() {
        const container = document.getElementById('driverTerminalContainer');
        if (!container) return;

        const verifiedCount = this.manifest.filter(m => m.checked).length;
        const totalManifest = this.manifest.length;

        container.innerHTML = `
            <div class="space-y-6">
                <!-- In-Cab Header Card -->
                <div class="modern-card p-5 sm:p-6">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                        <div class="flex items-center space-x-3.5">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                                <i class="fas fa-truck-medical text-xl"></i>
                            </div>
                            <div>
                                <div class="flex items-center space-x-2">
                                    <h3 class="text-base font-extrabold text-slate-900">${this.activeVehicle}</h3>
                                    <span class="pill-badge badge-emerald">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse"></span>
                                        GPS LIVE TRANSIT
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500 font-medium mt-0.5">Assigned Mission: Emergency Trauma Triage & Food Delivery</p>
                            </div>
                        </div>

                        <!-- Top In-Cab Controls -->
                        <div class="flex items-center flex-wrap gap-2">
                            <button onclick="DriverSim.toggleVoice()" 
                                class="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold flex items-center space-x-1.5 transition ${this.voiceEnabled ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-500'}">
                                <i class="fas ${this.voiceEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}"></i>
                                <span>Voice: ${this.voiceEnabled ? 'ON' : 'MUTED'}</span>
                            </button>

                            <button onclick="DriverSim.downloadOfflineMap()" 
                                class="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm">
                                <i class="fas fa-download text-xs"></i>
                                <span>Download Offline Map (.GeoJSON)</span>
                            </button>
                        </div>
                    </div>

                    <!-- Live In-Cab Telemetry HUD -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                        <div class="telemetry-chip">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Speed</div>
                            <div id="driverHudSpeed" class="text-lg font-mono font-extrabold text-slate-900 mt-0.5">${this.telemetry.speedKmH} km/h</div>
                            <div class="text-[10px] text-emerald-600 font-medium mt-0.5">Cruising Speed</div>
                        </div>

                        <div class="telemetry-chip">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Altitude</div>
                            <div class="text-lg font-mono font-extrabold text-slate-900 mt-0.5">${this.telemetry.altitudeM} m</div>
                            <div class="text-[10px] text-blue-600 font-medium mt-0.5">Mountain Ridge</div>
                        </div>

                        <div class="telemetry-chip">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heading</div>
                            <div class="text-lg font-mono font-extrabold text-slate-900 mt-0.5">${this.telemetry.heading}</div>
                            <div class="text-[10px] text-purple-600 font-medium mt-0.5">GPS Compass</div>
                        </div>

                        <div class="telemetry-chip">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining Distance</div>
                            <div class="text-lg font-mono font-extrabold text-slate-900 mt-0.5">${(this.telemetry.totalDistanceKm - this.telemetry.distanceCoveredKm).toFixed(1)} km</div>
                            <div class="text-[10px] text-amber-600 font-medium mt-0.5">ETA ~${this.telemetry.etaMin} mins</div>
                        </div>
                    </div>

                    <!-- Interactive Corridor Switcher -->
                    <div class="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <i class="fas fa-arrows-split-up-and-left text-blue-600"></i>
                                <span class="text-xs font-bold text-slate-900">Active Navigation Corridor</span>
                            </div>
                            <span class="text-[11px] text-slate-500 font-medium">Click to change route</span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <!-- Route 1 button -->
                            <button type="button" onclick="DriverSim.switchCorridor('ROUTE-1')" 
                                class="p-3 rounded-xl border text-left transition flex items-center justify-between ${this.activeRouteId === 'ROUTE-1' ? 'bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/20' : 'bg-white/60 border-slate-200 hover:bg-white'}">
                                <div>
                                    <div class="font-bold text-slate-900 flex items-center">
                                        <span class="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                                        Route 1: Safe Ridge Highway
                                    </div>
                                    <span class="text-[10px] text-slate-500 font-mono">34.2 km • ETA 18m • Lowest Risk</span>
                                </div>
                                ${this.activeRouteId === 'ROUTE-1' ? '<span class="pill-badge badge-emerald text-[10px]">ACTIVE</span>' : ''}
                            </button>

                            <!-- Route 2 button -->
                            <button type="button" onclick="DriverSim.switchCorridor('ROUTE-2')" 
                                class="p-3 rounded-xl border text-left transition flex items-center justify-between ${this.activeRouteId === 'ROUTE-2' ? 'bg-white border-amber-500 shadow-sm ring-2 ring-amber-500/20' : 'bg-white/60 border-slate-200 hover:bg-white'}">
                                <div>
                                    <div class="font-bold text-slate-900 flex items-center">
                                        <span class="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                                        Route 2: Valley Bypass
                                    </div>
                                    <span class="text-[10px] text-slate-500 font-mono">41.5 km • ETA 28m • Gravel Roughness</span>
                                </div>
                                ${this.activeRouteId === 'ROUTE-2' ? '<span class="pill-badge badge-amber text-[10px]">ACTIVE</span>' : ''}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Two-Column Section: Left (Turn-by-Turn Nav) + Right (Manifest & Quick Hazard Dispatch) -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    <!-- Left: Turn-by-Turn GPS Step Stream (7 Cols) -->
                    <div class="lg:col-span-7 modern-card p-5 sm:p-6 space-y-4">
                        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div class="flex items-center space-x-2">
                                <i class="fas fa-location-arrow text-blue-600"></i>
                                <h4 class="text-sm font-bold text-slate-900">Turn-by-Turn Route Guidance</h4>
                            </div>
                            <span class="text-xs font-mono text-slate-400">Step 3 of 5 Active</span>
                        </div>

                        <div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                            ${this.navSteps.map((step, idx) => {
                                let cardStyle = "bg-white border-slate-200 text-slate-600";
                                let iconStyle = "text-slate-400 bg-slate-100";
                                
                                if (step.status === "COMPLETED") {
                                    cardStyle = "bg-slate-50/70 border-slate-200 text-slate-400";
                                    iconStyle = "text-emerald-600 bg-emerald-50";
                                } else if (step.status === "CURRENT") {
                                    cardStyle = "bg-blue-50/80 border-blue-300 text-blue-950 font-bold shadow-sm ring-1 ring-blue-400/30";
                                    iconStyle = "text-blue-600 bg-blue-100 animate-pulse";
                                } else if (step.status === "HAZARD") {
                                    cardStyle = "bg-red-50 border-red-300 text-red-900 font-bold";
                                    iconStyle = "text-red-600 bg-red-100";
                                }

                                return `
                                    <div class="p-3 rounded-xl border text-xs flex items-center justify-between transition ${cardStyle}">
                                        <div class="flex items-center space-x-3">
                                            <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconStyle}">
                                                <i class="fas ${step.icon} text-xs"></i>
                                            </div>
                                            <div>
                                                <div>${step.instruction}</div>
                                                <span class="text-[10px] text-slate-400 font-semibold">${step.status}</span>
                                            </div>
                                        </div>
                                        <span class="font-mono text-xs font-bold text-slate-500 shrink-0 ml-3">${step.km}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Confirm Delivery Primary Action -->
                        <div class="pt-3 border-t border-slate-100">
                            <button onclick="DriverSim.confirmDelivery()" 
                                class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-2 transition shadow-md shadow-emerald-600/20">
                                <i class="fas fa-circle-check text-sm"></i>
                                <span>Confirm Safe Delivery at Destination</span>
                            </button>
                        </div>
                    </div>

                    <!-- Right: Cargo Checklist & Emergency Hazard Dispatcher (5 Cols) -->
                    <div class="lg:col-span-5 space-y-4">
                        
                        <!-- Cargo Manifest Checklist Card -->
                        <div class="modern-card p-5 space-y-3">
                            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div class="flex items-center space-x-2">
                                    <i class="fas fa-clipboard-check text-purple-600"></i>
                                    <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Cargo & Medical Manifest</h4>
                                </div>
                                <span class="pill-badge ${verifiedCount === totalManifest ? 'badge-emerald' : 'badge-amber'} text-[10px]">
                                    ${verifiedCount}/${totalManifest} Verified
                                </span>
                            </div>

                            <div class="space-y-1.5 text-xs">
                                ${this.manifest.map((item, idx) => `
                                    <label class="flex items-center space-x-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition">
                                        <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="DriverSim.toggleManifestItem(${idx})"
                                            class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300">
                                        <span class="${item.checked ? 'text-slate-800 font-medium' : 'text-slate-400 line-through'}">${item.item}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Multi-Hazard Emergency Quick-Report Card -->
                        <div class="modern-card p-5 space-y-3 border-red-100">
                            <div class="flex items-center space-x-2 pb-2 border-b border-slate-100">
                                <div class="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                                    <i class="fas fa-triangle-exclamation text-xs"></i>
                                </div>
                                <div>
                                    <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Emergency Hazard Dispatcher</h4>
                                    <p class="text-[10px] text-slate-500">Instantly alerts Central Hub & reroutes active fleet</p>
                                </div>
                            </div>

                            <div class="space-y-2 text-xs">
                                <button onclick="DriverSim.reportHazard('Major Landslide & Rockfall on Hill Pass')" 
                                    class="w-full p-2.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-800 font-semibold text-left transition flex items-center space-x-2.5">
                                    <i class="fas fa-land-mine-on text-red-600"></i>
                                    <span>Report Landslide / Boulder Fall</span>
                                </button>

                                <button onclick="DriverSim.reportHazard('Flash Flood / Bridge Submerged')" 
                                    class="w-full p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-800 font-semibold text-left transition flex items-center space-x-2.5">
                                    <i class="fas fa-water text-blue-600"></i>
                                    <span>Report Flood / Bridge Submerged</span>
                                </button>

                                <button onclick="DriverSim.reportHazard('Tree Fall & Downed Power Lines')" 
                                    class="w-full p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-800 font-semibold text-left transition flex items-center space-x-2.5">
                                    <i class="fas fa-tree text-amber-600"></i>
                                    <span>Report Tree Fall / Road Washout</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
    }
};

window.DriverSim = DriverSim;
