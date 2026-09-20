/**
 * Driver Guidance, Offline Map Download & Hazard Feedback Loop
 * Minimalist Light UI Edition
 */

const DriverSim = {
    activeVehicle: "Ambulance AMB-01",
    activeRoute: "Route 1 (Primary - Safe Ridge)",
    isOffline: false,
    navSteps: [
        { km: "0.0 km", instruction: "Depart State Disaster Operations Center (Main Hub)", status: "COMPLETED", icon: "fa-flag-checkered" },
        { km: "8.4 km", instruction: "Cross River Bypass Bridge - Speed limit 45 km/h", status: "COMPLETED", icon: "fa-bridge" },
        { km: "19.2 km", instruction: "Ridge Elevation Corridor - Road Safe & Clear of Flooding", status: "CURRENT", icon: "fa-road" },
        { km: "28.5 km", instruction: "Approaching Sector A Triage Checkpoint", status: "PENDING", icon: "fa-shield-halved" },
        { km: "34.2 km", instruction: "Arrive at Flooded Town Relief Distribution Camp", status: "PENDING", icon: "fa-location-dot" }
    ],

    init() {
        this.renderDriverTerminal();
    },

    downloadOfflineMap() {
        AudioController.playLoRaChirp();

        // Create GeoJSON vector map package
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
                offline_mode: "STANDALONE_GPS_ENABLED"
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
        
        // Update badge
        const badge = document.getElementById('driverOfflineBadge');
        if (badge) {
            badge.className = "px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center";
            badge.innerHTML = `<i class="fas fa-check-circle mr-1.5 text-emerald-600"></i> OFFLINE MAP CACHED`;
        }
    },

    async reportHazard(hazardType = "Severe Landslide Blockage") {
        try {
            AudioController.playHazardAlert();

            const res = await fetch('/api/driver/incident', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    driver: this.activeVehicle,
                    route_id: "ROUTE-1",
                    type: hazardType,
                    coordinates: [30.21, 78.86]
                })
            });

            const data = await res.json();
            
            this.showToast(`⚠️ Hazard Broadcast Sent! Central Hub notified: Route 1 closed, recalculating fleet routes.`, 'danger');

            if (window.App) {
                await window.App.fetchStatus();
            }

            this.navSteps.splice(2, 0, {
                km: "21.0 km",
                instruction: `⚠️ HAZARD ALERT: ${hazardType}. Diverted to Route 2 Bypass.`,
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
        this.showToast(`✅ Relief delivery verified at Location A! Mission feedback recorded in Central Hub.`, 'success');
        
        this.navSteps.forEach(s => s.status = "COMPLETED");
        this.renderDriverTerminal();

        if (window.App) {
            window.App.addLog(`Driver ${this.activeVehicle} confirmed successful delivery of relief supplies.`);
        }
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bg = type === 'danger' 
            ? 'bg-red-600 text-white shadow-red-200' 
            : (type === 'success' ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-slate-900 text-white shadow-slate-200');
        
        toast.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 transition-all transform duration-300 ${bg}`;
        toast.innerHTML = `
            <i class="fas ${type === 'danger' ? 'fa-triangle-exclamation' : (type === 'success' ? 'fa-circle-check' : 'fa-bell')} text-base"></i>
            <span class="text-sm font-medium">${message}</span>
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

        container.innerHTML = `
            <div class="white-card p-5 space-y-4">
                <!-- In-Cab Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                    <div class="flex items-center space-x-3">
                        <div class="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <i class="fas fa-truck-medical text-lg"></i>
                        </div>
                        <div>
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Fleet Unit</span>
                            <h3 class="text-base font-bold text-slate-900">${this.activeVehicle}</h3>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span id="driverOfflineBadge" class="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center">
                            <i class="fas fa-signal mr-1.5 text-blue-600"></i> LIVE 4G / LORA
                        </span>
                        <button onclick="DriverSim.downloadOfflineMap()" 
                            class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm">
                            <i class="fas fa-download text-xs"></i>
                            <span>Download Offline Map</span>
                        </button>
                    </div>
                </div>

                <!-- Active Route Banner -->
                <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div>
                        <div class="text-xs font-medium text-emerald-800">Assigned Safe Corridor</div>
                        <div class="text-sm font-bold text-emerald-950 flex items-center mt-0.5">
                            <i class="fas fa-shield-halved text-emerald-600 mr-2"></i> ${this.activeRoute}
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-xs text-emerald-700 font-medium">ETA</span>
                        <div class="text-sm font-bold font-mono text-emerald-900">18 mins (34.2 km)</div>
                    </div>
                </div>

                <!-- Turn-by-Turn GPS Step by Step -->
                <div class="space-y-2">
                    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Turn-by-Turn Route Guidance</div>
                    <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                        ${this.navSteps.map(step => {
                            let cardStyle = "bg-white border-slate-200 text-slate-600";
                            let iconStyle = "text-slate-400 bg-slate-100";
                            
                            if (step.status === "COMPLETED") {
                                cardStyle = "bg-slate-50 border-slate-200 text-slate-500";
                                iconStyle = "text-emerald-600 bg-emerald-50";
                            } else if (step.status === "CURRENT") {
                                cardStyle = "bg-blue-50/70 border-blue-300 text-blue-950 font-semibold ring-1 ring-blue-300";
                                iconStyle = "text-blue-600 bg-blue-100";
                            } else if (step.status === "HAZARD") {
                                cardStyle = "bg-red-50 border-red-300 text-red-900";
                                iconStyle = "text-red-600 bg-red-100";
                            }

                            return `
                                <div class="p-3 rounded-lg border text-xs flex items-center justify-between transition ${cardStyle}">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconStyle}">
                                            <i class="fas ${step.icon} text-xs"></i>
                                        </div>
                                        <div>
                                            <div>${step.instruction}</div>
                                            <span class="text-[10px] text-slate-400 font-medium">${step.status}</span>
                                        </div>
                                    </div>
                                    <span class="font-mono text-xs font-semibold text-slate-500 shrink-0 ml-3">${step.km}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Driver En-Route Actions -->
                <div class="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onclick="DriverSim.reportHazard('Landslide & Rockfall on Hill Pass')" 
                        class="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center justify-center space-x-2 transition">
                        <i class="fas fa-triangle-exclamation text-red-600"></i>
                        <span>Report Hazard (Reroutes Fleet)</span>
                    </button>
                    <button onclick="DriverSim.confirmDelivery()" 
                        class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm">
                        <i class="fas fa-circle-check"></i>
                        <span>Confirm Relief Delivered</span>
                    </button>
                </div>
            </div>
        `;
    }
};
