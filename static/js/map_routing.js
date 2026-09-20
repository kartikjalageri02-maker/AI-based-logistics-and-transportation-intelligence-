/**
 * Map & Disaster-Aware Routing Engine (Minimalist Light Theme)
 * - OpenStreetMap & CartoDB Positron Light Tiles
 * - Route 1 (Safe / Primary) vs Route 2 (Alternative) vs Route 3 (Blocked Landslide)
 * - Animated rescue vehicle simulation
 */

let disasterMap = null;
let routeLayers = [];
let markerLayers = [];
let activeVehicleMarkers = [];
let vehicleAnimationTimers = [];

function initDisasterMap(hub, locations, routes, hazards) {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    if (disasterMap) {
        disasterMap.remove();
        disasterMap = null;
    }

    const defaultCenter = [hub.lat || 30.22, hub.lon || 78.88];
    disasterMap = L.map('map', {
        center: defaultCenter,
        zoom: 11,
        zoomControl: true
    });

    // Clean Light CartoDB Positron Basemap with OSM attribution
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(disasterMap);

    renderMapEntities(hub, locations, routes, hazards);
}

function renderMapEntities(hub, locations, routes, hazards) {
    if (!disasterMap) return;

    // Clear previous layers
    routeLayers.forEach(layer => disasterMap.removeLayer(layer));
    markerLayers.forEach(marker => disasterMap.removeLayer(marker));
    routeLayers = [];
    markerLayers = [];

    // 1. Render Main Hub Marker
    const hubIcon = L.divIcon({
        className: 'custom-hub-icon',
        html: `<div class="hub-marker-pin"><i class="fas fa-satellite-dish text-white text-xs"></i></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34]
    });

    const hubMarker = L.marker([hub.lat, hub.lon], { icon: hubIcon })
        .addTo(disasterMap)
        .bindPopup(`
            <div class="p-2 font-sans">
                <div class="font-bold text-sm text-blue-600"><i class="fas fa-building mr-1"></i> ${hub.name}</div>
                <div class="text-xs text-slate-600 mt-1">Status: <span class="text-emerald-600 font-semibold">${hub.status}</span></div>
                <div class="text-xs text-slate-400 mt-0.5">Coordinates: ${hub.lat.toFixed(4)}, ${hub.lon.toFixed(4)}</div>
            </div>
        `);
    markerLayers.push(hubMarker);

    // 2. Render Disaster Locations (Location A, Location B, etc.)
    locations.forEach(loc => {
        const isCritical = (loc.ai_analysis?.severity_score || 70) >= 75;
        const colorClass = isCritical ? 'bg-red-600 text-white animate-pulse-danger' : 'bg-amber-500 text-white';
        
        const locIcon = L.divIcon({
            className: 'custom-loc-icon',
            html: `
                <div class="relative flex items-center justify-center">
                    <div class="w-8 h-8 rounded-full ${colorClass} border-2 border-white shadow-md flex items-center justify-center text-xs font-bold font-mono">
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
                <div class="p-2 font-sans min-w-[210px]">
                    <div class="font-bold text-sm text-slate-900 flex items-center justify-between pb-1 border-b border-slate-100">
                        <span>${loc.name}</span>
                        <span class="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono">${loc.ai_analysis?.severity_score || 80}/100</span>
                    </div>
                    <div class="text-xs text-slate-700 mt-1.5"><strong>Condition:</strong> ${loc.condition}</div>
                    <div class="text-xs text-slate-700"><strong>Road Access:</strong> ${loc.road_condition}</div>
                    <div class="text-xs text-slate-700"><strong>Civilians:</strong> ${loc.affected_people} affected</div>
                    <div class="text-xs text-blue-600 mt-1 font-mono"><i class="fas fa-tower-broadcast mr-1"></i> ${loc.communication_mode}</div>
                </div>
            `);
        markerLayers.push(marker);
    });

    // 3. Render Hazards / Blocked Points (Landslide, Flood Cutoff)
    hazards.forEach(h => {
        const hazardIcon = L.divIcon({
            className: 'custom-hazard-icon',
            html: `<div class="hazard-marker-pin"><i class="fas fa-triangle-exclamation text-white text-xs"></i></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const hMarker = L.marker([h.lat, h.lon], { icon: hazardIcon })
            .addTo(disasterMap)
            .bindPopup(`
                <div class="p-2 font-sans">
                    <div class="font-bold text-sm text-red-600"><i class="fas fa-land-mine-on mr-1"></i> ${h.name}</div>
                    <div class="text-xs text-slate-700 mt-1">Hazard: <span class="font-semibold text-red-600">${h.type}</span></div>
                    <div class="text-xs text-slate-600">Corridor: <strong>${h.affected_route}</strong></div>
                    <div class="text-xs text-amber-600 mt-0.5 font-medium">Clearance Unit: ${h.clearing_equipment}</div>
                </div>
            `);
        markerLayers.push(hMarker);
    });

    // 4. Render Disaster-Aware Prioritized Routes
    routes.forEach(r => {
        const isBlocked = r.is_blocked || r.status === 'BLOCKED';
        const polylineOptions = {
            color: isBlocked ? '#ef4444' : (r.color || '#059669'),
            weight: isBlocked ? 4 : 6,
            opacity: isBlocked ? 0.7 : 0.85,
            dashArray: isBlocked ? '6, 6' : null
        };

        const polyline = L.polyline(r.path, polylineOptions).addTo(disasterMap);
        
        polyline.bindPopup(`
            <div class="p-2 font-sans">
                <div class="font-bold text-sm" style="color: ${isBlocked ? '#ef4444' : '#059669'}">${r.name}</div>
                <div class="text-xs text-slate-700 mt-1">Status: <strong>${r.status}</strong></div>
                <div class="text-xs text-slate-600">${r.description}</div>
                <div class="text-xs text-slate-500 mt-1">Distance: ${r.distance_km} km | Risk Index: ${r.risk_score}/100</div>
            </div>
        `);
        routeLayers.push(polyline);
    });

    // Fit map bounds
    if (routes.length > 0 && routes[0].path.length > 0) {
        const group = new L.featureGroup(routeLayers);
        disasterMap.fitBounds(group.getBounds().pad(0.12));
    }
}

/**
 * Animated Fleet Vehicle Movement Simulation along safe corridor
 */
function startVehicleMovementSimulation(routePath, vehicleLabel = "AMB-01", vehicleColor = "#059669") {
    if (!disasterMap) return;

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
        .bindTooltip(`<strong>${vehicleLabel}</strong><br>Status: GPS Live Transit`, {
            permanent: false,
            direction: 'top'
        });
    activeVehicleMarkers.push(vMarker);

    let step = 0;
    const totalPoints = 120;
    
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
