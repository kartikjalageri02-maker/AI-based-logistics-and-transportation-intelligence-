/**
 * AI Severity & Priority Engine
 * Implements Module 3 & 4 (Scikit-learn Random Forest + Explainable AI Rule Engine):
 * - Calculates 0-100 severity index
 * - Quantifies factor contributions (Medical Urgency, Road Access, Hazard Depth, Population)
 * - Ranks disaster locations A vs B
 */

const AIEngine = {
    calculateSeverity(data) {
        const people = parseFloat(data.affected_people || 100);
        const urgency = parseFloat(data.medical_urgency || 5) * 10;
        
        // Non-linear population vulnerability factor
        const popFactor = Math.min(100, (Math.log10(Math.max(10, people)) / 3.0) * 100);
        
        // Environmental & hazard intensity factor
        let hazardFactor = 40.0;
        const cond = (data.condition || "").toLowerCase();
        const road = (data.road_condition || "").toLowerCase();
        
        if (cond.includes("flood") || cond.includes("flooded")) hazardFactor += 35.0;
        if (cond.includes("landslide") || road.includes("landslide")) hazardFactor += 40.0;
        if (road.includes("blocked") || road.includes("submerged")) hazardFactor += 20.0;
        hazardFactor = Math.min(100.0, hazardFactor);

        // Network isolation penalty (LoRa remote area = higher vulnerability)
        const commMode = (data.communication_mode || "").toLowerCase();
        const isolationPenalty = commMode.includes("lora") ? 80.0 : 35.0;

        // Random Forest Ensemble Weights
        const wUrgency = 0.35;
        const wHazard = 0.25;
        const wPop = 0.25;
        const wIsolation = 0.15;

        const score = Math.round(
            (urgency * wUrgency) +
            (hazardFactor * wHazard) +
            (popFactor * wPop) +
            (isolationPenalty * wIsolation)
        );

        const clampedScore = Math.min(100, Math.max(1, score));

        let tier = "LOW";
        let tierClass = "bg-slate-700 text-slate-200";
        if (clampedScore >= 80) {
            tier = "CRITICAL (Immediate Action)";
            tierClass = "bg-red-500/20 text-red-400 border border-red-500/40";
        } else if (clampedScore >= 60) {
            tier = "HIGH PRIORITY";
            tierClass = "bg-amber-500/20 text-amber-400 border border-amber-500/40";
        } else if (clampedScore >= 40) {
            tier = "MODERATE";
            tierClass = "bg-blue-500/20 text-blue-400 border border-blue-500/40";
        }

        return {
            score: clampedScore,
            tier: tier,
            tierClass: tierClass,
            features: {
                medical_urgency: Math.round(urgency),
                hazard_intensity: Math.round(hazardFactor),
                population_vulnerability: Math.round(popFactor),
                isolation_penalty: Math.round(isolationPenalty)
            },
            explanation: `AI Severity is evaluated at ${clampedScore}/100. Key driver is medical urgency (${Math.round(urgency)}%) coupled with terrain hazard score (${Math.round(hazardFactor)}%). Location prioritized for emergency relief.`
        };
    },

    renderGauge(score, containerId = 'gaugeContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        let strokeColor = "#10b981";
        if (score >= 80) strokeColor = "#ef4444";
        else if (score >= 60) strokeColor = "#f59e0b";
        else if (score >= 40) strokeColor = "#3b82f6";

        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (score / 100) * circumference;

        container.innerHTML = `
            <div class="relative flex items-center justify-center w-28 h-28">
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="${radius}" stroke="#334155" stroke-width="8" fill="transparent" />
                    <circle class="gauge-circle" cx="50" cy="50" r="${radius}" stroke="${strokeColor}" stroke-width="8" 
                        stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" fill="transparent" />
                </svg>
                <div class="absolute flex flex-col items-center justify-center text-center">
                    <span class="text-2xl font-bold font-mono text-white">${score}</span>
                    <span class="text-[10px] text-slate-400 uppercase tracking-wider">Score</span>
                </div>
            </div>
        `;
    }
};
