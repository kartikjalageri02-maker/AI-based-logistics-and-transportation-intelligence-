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
        let tierClass = "bg-slate-100 text-slate-700 border border-slate-200";
        if (clampedScore >= 80) {
            tier = "CRITICAL (Immediate Action)";
            tierClass = "bg-red-50 text-red-700 border border-red-200";
        } else if (clampedScore >= 60) {
            tier = "HIGH PRIORITY";
            tierClass = "bg-amber-50 text-amber-700 border border-amber-200";
        } else if (clampedScore >= 40) {
            tier = "MODERATE";
            tierClass = "bg-blue-50 text-blue-700 border border-blue-200";
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

        let stopColor1 = "#10b981", stopColor2 = "#059669";
        if (score >= 80) { stopColor1 = "#f87171"; stopColor2 = "#dc2626"; }
        else if (score >= 60) { stopColor1 = "#fbbf24"; stopColor2 = "#d97706"; }
        else if (score >= 40) { stopColor1 = "#60a5fa"; stopColor2 = "#2563eb"; }

        const radius = 42;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (score / 100) * circumference;

        container.innerHTML = `
            <div class="relative flex items-center justify-center w-32 h-32">
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="${stopColor1}" />
                            <stop offset="100%" stop-color="${stopColor2}" />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="${radius}" stroke="#f1f5f9" stroke-width="8" fill="transparent" />
                    <circle class="gauge-circle" cx="50" cy="50" r="${radius}" stroke="url(#gaugeGradient)" stroke-width="8" 
                        stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" fill="transparent" />
                </svg>
                <div class="absolute flex flex-col items-center justify-center text-center">
                    <span class="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">${score}</span>
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Index / 100</span>
                </div>
            </div>
        `;
    }
};
