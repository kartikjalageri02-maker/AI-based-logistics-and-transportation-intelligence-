/**
 * Driver Guidance, Offline PWA Navigation & Incident Feedback Loop
 * Implements Module 7, 8 & 9 from the architecture diagrams:
 * - Driver In-Cab terminal view
 * - Offline navigation simulation
 * - Active route switcher
 * - Real-time Incident Reporting button (Landslide/Blocked Road)
 * - Dynamic feedback loop to Hub to recalculate fleet routes
 */

const DriverSim = {
    activeVehicle: "Ambulance AMB-01",
    activeRoute: "Route 1 (Primary - Safe Ridge)",
    isOffline: false,
    navSteps: [
        { km: "0.0 km", instruction: "Depart State Disaster Operations Center (Main Hub)", status: "COMPLETED", icon: "fa-flag-checkered" },
        { km: "8.4 km", instruction: "Cross River Bypass Bridge - Speed 45 km/h", status: "COMPLETED", icon: "fa-bridge" },
        { km: "19.2 km", instruction: "Ridge Elevation Corridor - Road Safe & Clear of Flooding", status: "CURRENT", icon: "fa-road" },
        { km: "28.5 km", instruction: "Approaching Sector A Triage Checkpoint", status: "PENDING", icon: "fa-shield-halved" },
        { km: "34.2 km", instruction: "Arrive at Flooded Town Relief Distribution Center", status: "PENDING", icon: "fa-location-dot" }
    ],

    init() {
        this.renderDriverTerminal();
    },

    toggleOfflineMode() {
        this.isOffline = !this.isOffline;
        const badge = document.getElementById('driverOfflineBadge');
        if (badge) {
            if (this.isOffline) {
                badge.className = "px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center";
                badge.innerHTML = `<i class="fas fa-check-circle mr-1"></i> OFFLINE PWA CACHE ACTIVE`;
            } else {
                badge.className = "px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center";
                badge.innerHTML = `<i class="fas fa-satellite mr-1"></i> 4G LTE CONNECTED`;
            }
        }
    },

    async reportHazard(hazardType = "Severe Landslide Blockage") {
        try {
            // Sound synthesis alert
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
            
            // Notification toast
            this.showToast(`⚠️ Hazard Reported! Hub notified: Route 1 blocked, switching to Route 2 (Alternative).`, 'danger');

            // Refresh app state
            if (window.App) {
                window.App.fetchStatus();
            }

            // Update step status
            this.navSteps.splice(2, 0, {
                km: "21.0 km",
                instruction: `⚠️ HAZARD REPORTED: ${hazardType}. Diverted to Route 2 Bypass.`,
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
        this.showToast(`✅ Relief Cargo safely delivered at Location A. Feedback loop updated in Central Hub!`, 'success');
        
        // Mark all steps completed
        this.navSteps.forEach(s => s.status = "COMPLETED");
        this.renderDriverTerminal();

        if (window.App) {
            window.App.addLog(`Driver ${this.activeVehicle} confirmed successful delivery of medical & relief supplies at Location A.`);
        }
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bg = type === 'danger' ? 'bg-red-600 border-red-400' : 'bg-emerald-600 border-emerald-400';
        toast.className = `fixed bottom-6 right-6 z-50 p-4 rounded-xl text-white shadow-2xl border flex items-center space-x-3 transition-all transform duration-300 ${bg}`;
        toast.innerHTML = `
            <i class="fas ${type === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-check'} text-lg"></i>
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
            <div class="hud-border rounded-xl p-4 bg-slate-900/90 border border-slate-700">
                <!-- In-Cab Header -->
                <div class="flex items-center justify-between pb-3 border-b border-slate-700">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <i class="fas fa-truck-medical text-lg"></i>
                        </div>
                        <div>
                            <div class="text-xs text-slate-400 uppercase font-mono">Driver In-Cab Navigation Unit</div>
                            <div class="text-sm font-bold text-white">${this.activeVehicle}</div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span id="driverOfflineBadge" class="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center cursor-pointer" onclick="DriverSim.toggleOfflineMode()" title="Click to test offline cache">
                            <i class="fas fa-satellite mr-1"></i> 4G LTE CONNECTED
                        </span>
                    </div>
                </div>

                <!-- Active Route Banner -->
                <div class="mt-3 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                    <div>
                        <div class="text-[10px] text-slate-400 uppercase font-mono">Active Corridors</div>
                        <div class="text-xs font-bold text-emerald-400 flex items-center mt-0.5">
                            <i class="fas fa-route mr-1.5"></i> ${this.activeRoute}
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] text-slate-400 font-mono">ETA</span>
                        <div class="text-xs font-mono font-bold text-white">18 mins (34.2 km)</div>
                    </div>
                </div>

                <!-- Turn-by-Turn GPS steps -->
                <div class="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    ${this.navSteps.map(step => {
                        let colorClass = "text-slate-400 border-slate-700";
                        let iconColor = "text-slate-500";
                        if (step.status === "COMPLETED") {
                            colorClass = "text-slate-300 border-emerald-500/30 bg-emerald-500/5";
                            iconColor = "text-emerald-400";
                        } else if (step.status === "CURRENT") {
                            colorClass = "text-white border-blue-500 bg-blue-500/10";
                            iconColor = "text-blue-400 animate-bounce";
                        } else if (step.status === "HAZARD") {
                            colorClass = "text-red-300 border-red-500 bg-red-500/10";
                            iconColor = "text-red-400";
                        }

                        return `
                            <div class="p-2 rounded border text-xs flex items-center justify-between ${colorClass}">
                                <div class="flex items-center space-x-2.5">
                                    <i class="fas ${step.icon} ${iconColor} text-xs"></i>
                                    <span class="font-medium">${step.instruction}</span>
                                </div>
                                <span class="font-mono text-[10px] text-slate-400 shrink-0 ml-2">${step.km}</span>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Driver Actions -->
                <div class="mt-4 pt-3 border-t border-slate-700 grid grid-cols-2 gap-2">
                    <button onclick="DriverSim.reportHazard('Landslide & Rockfall on Ridge')" 
                        class="px-3 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 text-xs font-semibold flex items-center justify-center space-x-1.5 transition">
                        <i class="fas fa-triangle-exclamation"></i>
                        <span>Report Hazard (Feedback Loop)</span>
                    </button>
                    <button onclick="DriverSim.confirmDelivery()" 
                        class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-lg shadow-emerald-600/20">
                        <i class="fas fa-circle-check"></i>
                        <span>Confirm Relief Delivered</span>
                    </button>
                </div>
            </div>
        `;
    }
};
