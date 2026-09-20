/**
 * Map & Disaster-Aware Routing Engine
 * Implements Module 6 & 7:
 * - Leaflet OpenStreetMap interactive integration
 * - Route 1 (Safe / Primary) vs Route 2 (Alternative) vs Route 3 (Blocked Landslide)
 * - Hazard alerts & dynamic re-routing
 * - Animated vehicle dispatch along polylines
 */

let disasterMap = null;
let routeLayers = [];
let markerLayers = [];
let activeVehicleMarkers = [];
let vehicleAnimationTimers = [];

function initDisasterMap(hub, locations, routes, hazards) {
    if (disasterMap) {
        disasterMap.remove();
    }

    const defaultCenter = [hub.lat || 30.22, hub.lon || 78.88];
    disasterMap = L.map('map', {
        center: defaultCenter,
        zoom: 11,
        zoomControl: true
    });

    // Dark-mode cartographic tiles (CartoDB DarkMatter) with OSM fallback
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(disasterMap);

    renderMapEntities(hub, locations, routes, hazards);
}

function renderMapEntities(hub, locations, routes, hazards) {
    // Clear previous layers
    routeLayers.forEach(layer => disasterMap.removeLayer(layer));
    markerLayers.forEach(marker => disasterMap.removeLayer(marker));
    routeLayers = [];
    markerLayers = [];

    // 1. Render Main Hub Marker
    const hubIcon = L.divIcon({
        className: 'custom-hub-icon',
        html: `<div class="hub-marker-pin"><i class="fas fa-satellite-dish text-white text-xs"></i></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
    });

    const hubMarker = L.marker([hub.lat, hub.lon], { icon: hubIcon })
        .addTo(disasterMap)
        .bindPopup(`
            <div class="p-2 text-slate-900">
                <div class="font-bold text-sm text-blue-700"><i class="fas fa-building mr-1"></i> ${hub.name}</div>
                <div class="text-xs text-slate-600 mt-1">Status: <span class="text-emerald-600 font-semibold">${hub.status}</span></div>
                <div class="text-xs text-slate-500">Coord: ${hub.lat.toFixed(4)}, ${hub.lon.toFixed(4)}</div>
            </div>
        `);
    markerLayers.push(hubMarker);

    // 2. Render Disaster Locations (Location A, Location B, etc.)
    locations.forEach(loc => {
        const isCritical = (loc.ai_analysis?.severity_score || 70) >= 75;
        const colorClass = isCritical ? 'bg-red-600 animate-pulse-red' : 'bg-amber-500';
        
        const locIcon = L.divIcon({
            className: 'custom-loc-icon',
            html: `
                <div class="relative flex items-center justify-center">
                    <div class="w-8 h-8 rounded-full ${colorClass} border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-lg">
                        ${loc.id.replace('LOC-', '')}
                    </div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const marker = L.marker([loc.lat, loc.lon], { icon: locIcon })
            .addTo(disasterMap)
            .bindPopup(`
                <div class="p-2 text-slate-900 min-w-[200px]">
                    <div class="font-bold text-sm text-red-700 flex items-center justify-between">
                        <span>${loc.name}</span>
                        <span class="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-mono">${loc.ai_analysis?.severity_score || 80}/100</span>
                    </div>
                    <div class="text-xs text-slate-700 mt-1.5"><strong>Condition:</strong> ${loc.condition}</div>
                    <div class="text-xs text-slate-700"><strong>Road:</strong> ${loc.road_condition}</div>
                    <div class="text-xs text-slate-700"><strong>People Affected:</strong> ${loc.affected_people}</div>
                    <div class="text-xs text-blue-700 mt-1 font-mono"><i class="fas fa-broadcast-tower mr-1"></i> ${loc.communication_mode}</div>
                </div>
            `);
        markerLayers.push(marker);
    });

    // 3. Render Hazards / Blocked Points (Landslide, Flood Cutoff)
    hazards.forEach(h => {
        const hazardIcon = L.divIcon({
            className: 'custom-hazard-icon',
            html: `<div class="hazard-marker-pin"><i class="fas fa-triangle-exclamation text-white text-sm"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const hMarker = L.marker([h.lat, h.lon], { icon: hazardIcon })
            .addTo(disasterMap)
            .bindPopup(`
                <div class="p-2 text-slate-900">
                    <div class="font-bold text-sm text-red-600"><i class="fas fa-land-mine-on mr-1"></i> ${h.name}</div>
                    <div class="text-xs text-slate-700 mt-1">Hazard Type: <span class="font-semibold text-red-700">${h.type}</span></div>
                    <div class="text-xs text-slate-600">Affected Corridor: <strong>${h.affected_route}</strong></div>
                    <div class="text-xs text-amber-700 mt-1 font-semibold">Equipment Required: ${h.clearing_equipment}</div>
                </div>
            `);
        markerLayers.push(hMarker);
    });

    // 4. Render Disaster-Aware Prioritized Routes
    routes.forEach(r => {
        const isBlocked = r.is_blocked || r.status === 'BLOCKED';
        const polylineOptions = {
            color: r.color || (isBlocked ? '#ef4444' : '#10b981'),
            weight: isBlocked ? 4 : 6,
            opacity: isBlocked ? 0.6 : 0.9,
            dashArray: isBlocked ? '8, 8' : null
        };

        const polyline = L.polyline(r.path, polylineOptions).addTo(disasterMap);
        
        polyline.bindPopup(`
            <div class="p-2 text-slate-900">
                <div class="font-bold text-sm" style="color: ${r.color || '#10b981'}">${r.name}</div>
                <div class="text-xs text-slate-700 mt-1">Status: <strong>${r.status}</strong></div>
                <div class="text-xs text-slate-600">${r.description}</div>
                <div class="text-xs text-slate-500 mt-1">Length: ${r.distance_km} km | Risk Index: ${r.risk_score}/100</div>
            </div>
        `);
        routeLayers.push(polyline);
    });

    // Fit map bounds
    if (routes.length > 0 && routes[0].path.length > 0) {
        const group = new L.featureGroup(routeLayers);
        disasterMap.fitBounds(group.getBounds().pad(0.15));
    }
}

/**
 * Animated Fleet Vehicle Simulation along safe corridor
 */
function startVehicleMovementSimulation(routePath, vehicleLabel = "AMB-01", vehicleColor = "#10b981") {
    // Clear existing
    activeVehicleMarkers.forEach(m => disasterMap.removeLayer(m));
    activeVehicleMarkers = [];
    vehicleAnimationTimers.forEach(t => clearInterval(t));
    vehicleAnimationTimers = [];

    if (!routePath || routePath.length < 2) return;

    const vehicleIcon = L.divIcon({
        className: 'vehicle-marker-icon',
        html: `
            <div class="vehicle-marker-pin" style="background: ${vehicleColor}">
                <i class="fas fa-truck-medical text-white text-[10px]"></i>
            </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const vMarker = L.marker(routePath[0], { icon: vehicleIcon })
        .addTo(disasterMap)
        .bindTooltip(`<strong>${vehicleLabel}</strong><br>Status: In-Transit (GPS Live)`, {
            permanent: false,
            direction: 'top'
        });
    activeVehicleMarkers.push(vMarker);

    let step = 0;
    const totalPoints = 120;
    
    // Interpolate points along the path
    const interpolated = [];
    for (let i = 0; i < routePath.length - 1; i++) {
        const p1 = routePath[i];
        const p2 = routePath[i + 1];
        const subSteps = Math.floor(totalPoints / (routePath.length - 1));
        for (let s = 0; s < subSteps; s++) {
            const fraction = s / subSteps;
            const lat = p1[0] + (p2[0] - p1[0]) * fraction;
            const lon = p1[1] + (p2[1] - p1[1]) * fraction;
            interpolated.push([lat, lon]);
        }
    }
    interpolated.push(routePath[routePath.length - 1]);

    const timer = setInterval(() => {
        step = (step + 1) % interpolated.length;
        const currentCoord = interpolated[step];
        vMarker.setLatLng(currentCoord);
    }, 120);

    vehicleAnimationTimers.push(timer);
}
