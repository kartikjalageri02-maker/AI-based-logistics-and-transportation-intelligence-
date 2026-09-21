/**
 * Resource Allocation & Vehicle Equipment Selection Optimizer
 * Implements Module 4, 5 & 6 (Google OR-Tools inspired optimization):
 * - Solves limited resource allocation under scarcity
 * - Selects specialized vehicles (Ambulance, Truck, Small Vehicle, Boat, JCB)
 * - Generates alternative support plans for lower-priority locations
 */

const Optimizer = {
    solve(locations, inventory) {
        // Evaluate AI severity for each location
        const evaluated = locations.map(loc => {
            const ai = AIEngine.calculateSeverity(loc);
            return {
                loc: loc,
                ai: ai
            };
        });

        // Sort descending by AI severity score (higher priority gets first allocation)
        evaluated.sort((a, b) => b.ai.score - a.ai.score);

        // Copy inventory stocks
        let poolAmbulances = inventory.ambulances?.available || 3;
        let poolTrucks = inventory.trucks?.available || 5;
        let poolBoats = inventory.boats?.available || 3;
        let poolJCBs = inventory.jcbs?.available || 2;
        let poolFood = inventory.food_packs?.available || 1200;
        let poolMeds = inventory.medicines?.available || 850;
        let poolWater = inventory.water_liters?.available || 5000;

        const results = [];

        evaluated.forEach((item, index) => {
            const loc = item.loc;
            const demand = loc.demand || {};
            const reqAmb = demand.ambulances || 1;
            const reqFood = demand.food_packs || 200;
            const reqMeds = demand.medicines || 150;
            const reqWater = demand.water_liters || 1000;
            const reqBoats = demand.boats || (loc.condition.toLowerCase().includes('flood') ? 1 : 0);

            // Optimization logic for ambulances (scarcity constraint example from diagram)
            let allocAmb = 0;
            let ambNote = "";
            let altPlan = null;

            if (poolAmbulances >= reqAmb) {
                allocAmb = reqAmb;
                poolAmbulances -= allocAmb;
                ambNote = "100% Demand Met";
            } else if (poolAmbulances > 0) {
                allocAmb = poolAmbulances;
                const deficit = reqAmb - allocAmb;
                poolAmbulances = 0;
                ambNote = `Partial: ${allocAmb}/${reqAmb} Ambulances Assigned`;
                altPlan = `Alternative Plan Activated: ${deficit} mobile paramedic units assigned on 4x4 rugged vehicles; aerial triage on standby.`;
            } else {
                allocAmb = 0;
                ambNote = "Exhausted from primary pool";
                altPlan = "Deferred to Batch 2 dispatch; telemedicine & stabilization kits deployed.";
            }

            // Supply allocations
            const allocFood = Math.min(reqFood, poolFood);
            poolFood -= allocFood;

            const allocMeds = Math.min(reqMeds, poolMeds);
            poolMeds -= allocMeds;

            const allocWater = Math.min(reqWater, poolWater);
            poolWater -= allocWater;

            const allocBoats = Math.min(reqBoats, poolBoats);
            poolBoats -= allocBoats;

            // Specialized vehicle matching
            const vehicles = [];
            if (allocAmb > 0) {
                vehicles.push({ type: "Ambulance", count: allocAmb, icon: "fa-truck-medical", color: "text-red-400", purpose: "Emergency Trauma & Patient Transit" });
            }
            if (allocFood > 0 || allocWater > 0) {
                vehicles.push({ type: "Heavy Cargo Truck", count: 1, icon: "fa-truck-moving", color: "text-amber-400", purpose: "Bulk Rations & Drinking Water" });
            }
            if (allocBoats > 0) {
                vehicles.push({ type: "Inflatable Rescue Boat", count: allocBoats, icon: "fa-ship", color: "text-cyan-400", purpose: "River & Flooded Sector Extraction" });
            }
            if (loc.road_condition.toLowerCase().includes("landslide") || loc.condition.toLowerCase().includes("landslide")) {
                const allocJCB = Math.min(1, poolJCBs);
                poolJCBs -= allocJCB;
                vehicles.push({ type: "JCB / Heavy Excavator", count: allocJCB, icon: "fa-trowel-bricks", color: "text-yellow-500", purpose: "Landslide Road Clearance" });
            }
            if (loc.road_condition.toLowerCase().includes("narrow") || loc.road_condition.toLowerCase().includes("steep")) {
                vehicles.push({ type: "4x4 Small Recon Vehicle", count: 1, icon: "fa-car-side", color: "text-emerald-400", purpose: "Narrow Mountain Pass Navigation" });
            }

            results.push({
                location: loc,
                ai: item.ai,
                rank: index + 1,
                priorityLabel: index === 0 ? "Location A (Higher Priority)" : `Location ${String.fromCharCode(65 + index)} (Lower Priority)`,
                allocated: {
                    ambulances: allocAmb,
                    food_packs: allocFood,
                    medicines: allocMeds,
                    water_liters: allocWater,
                    boats: allocBoats
                },
                ambNote: ambNote,
                alternativePlan: altPlan,
                vehicles: vehicles
            });
        });

        return {
            allocations: results,
            remainingPool: {
                ambulances: poolAmbulances,
                food_packs: poolFood,
                medicines: poolMeds,
                water_liters: poolWater,
                boats: poolBoats,
                jcbs: poolJCBs
            }
        };
    },

    renderAllocationCards(containerId, results) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-5">';

        results.allocations.forEach(item => {
            const isTop = item.rank === 1;
            const badgeClass = isTop ? 'badge-red' : 'badge-blue';
            
            html += `
                <div class="modern-card p-6 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
                            <div>
                                <span class="pill-badge ${badgeClass}">
                                    ${item.priorityLabel}
                                </span>
                                <h4 class="text-base font-extrabold text-slate-900 mt-1.5">${item.location.name}</h4>
                            </div>
                            <div class="text-right">
                                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI Severity</div>
                                <div class="text-xl font-mono font-extrabold ${isTop ? 'text-red-600' : 'text-amber-600'}">
                                    ${item.ai.score}/100
                                </div>
                            </div>
                        </div>

                        <!-- Resource Allocations -->
                        <div class="mt-4">
                            <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                                <span><i class="fas fa-boxes-stacked mr-1.5 text-blue-600"></i> Allocated Relief Quotas</span>
                                <span class="text-[10px] text-emerald-600 font-semibold font-mono">100% Demand Evaluated</span>
                            </div>
                            <div class="grid grid-cols-2 gap-2.5 text-xs">
                                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span class="text-slate-600 font-medium"><i class="fas fa-truck-medical text-red-500 mr-1.5"></i> Ambulances:</span>
                                    <span class="font-mono font-bold text-slate-900">${item.allocated.ambulances} units</span>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span class="text-slate-600 font-medium"><i class="fas fa-box-tissue text-amber-500 mr-1.5"></i> Food Packs:</span>
                                    <span class="font-mono font-bold text-slate-900">${item.allocated.food_packs} pk</span>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span class="text-slate-600 font-medium"><i class="fas fa-pills text-purple-500 mr-1.5"></i> Medicines:</span>
                                    <span class="font-mono font-bold text-slate-900">${item.allocated.medicines} kits</span>
                                </div>
                                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <span class="text-slate-600 font-medium"><i class="fas fa-faucet-drip text-cyan-600 mr-1.5"></i> Water:</span>
                                    <span class="font-mono font-bold text-slate-900">${item.allocated.water_liters} L</span>
                                </div>
                            </div>
                            ${item.allocated.boats > 0 ? `
                                <div class="mt-2.5 bg-cyan-50/60 p-2.5 rounded-xl border border-cyan-100 flex items-center justify-between text-xs">
                                    <span class="text-cyan-800 font-medium"><i class="fas fa-ship text-cyan-600 mr-1.5"></i> Rescue Boats (Submerged Zone):</span>
                                    <span class="font-mono font-bold text-cyan-950">${item.allocated.boats} units</span>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Specialized Vehicles Assigned -->
                        <div class="mt-4">
                            <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                                <i class="fas fa-truck-ramp-box mr-1.5 text-emerald-600"></i> Assigned Vehicles & Machinery
                            </div>
                            <div class="space-y-2">
                                ${item.vehicles.map(v => `
                                    <div class="bg-white border border-slate-200/80 p-2.5 rounded-xl flex items-center justify-between text-xs shadow-2xs hover:border-slate-300 transition">
                                        <div class="flex items-center space-x-2.5">
                                            <i class="fas ${v.icon} ${v.color.replace('text-red-400', 'text-red-600').replace('text-amber-400', 'text-amber-600').replace('text-cyan-400', 'text-cyan-600').replace('text-emerald-400', 'text-emerald-600')} text-sm"></i>
                                            <span class="font-bold text-slate-900">${v.type} (${v.count})</span>
                                        </div>
                                        <span class="text-[11px] text-slate-500 font-medium">${v.purpose}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Alternative Plan if Constrained -->
                        ${item.alternativePlan ? `
                            <div class="mt-4 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs">
                                <div class="text-amber-900 font-bold flex items-center">
                                    <i class="fas fa-shuffle mr-1.5 text-amber-600"></i> Contingency / Alternative Support Plan
                                </div>
                                <p class="text-amber-800 mt-1 text-[11px] leading-relaxed font-medium">${item.alternativePlan}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }
};
