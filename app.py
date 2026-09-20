"""
AI Intelligent Accessibility in Logistics & Transportation
Disaster Response & Smart Allocation Prototype Server
Zero-external-dependency HTTP & REST server using Python 3.11 Standard Library.
"""

import http.server
import socketserver
import json
import urllib.parse
import os
import mimetypes
import time
import math

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Initial Disaster Scenarios & State
DEFAULT_STATE = {
    "hub": {
        "id": "HUB-01",
        "name": "State Disaster Operations Center (Main Hub)",
        "lat": 30.1450,
        "lon": 78.7800,
        "contact": "+91-1800-DISASTER",
        "status": "ACTIVE_COMMAND"
    },
    "inventory": {
        "ambulances": {"total": 3, "allocated": 0, "available": 3},
        "trucks": {"total": 5, "allocated": 0, "available": 5},
        "boats": {"total": 3, "allocated": 0, "available": 3},
        "jcbs": {"total": 2, "allocated": 0, "available": 2},
        "small_vehicles": {"total": 4, "allocated": 0, "available": 4},
        "food_packs": {"total": 1200, "allocated": 0, "available": 1200},
        "medicines": {"total": 850, "allocated": 0, "available": 850},
        "water_liters": {"total": 5000, "allocated": 0, "available": 5000},
        "tents": {"total": 200, "allocated": 0, "available": 200}
    },
    "locations": [
        {
            "id": "LOC-A",
            "name": "Location A (Flooded Town - Rudra Valley)",
            "lat": 30.2850,
            "lon": 78.9800,
            "condition": "Flooded Area & Bridge Stress",
            "affected_people": 650,
            "medical_urgency": 9,  # scale 1-10
            "road_condition": "Flooded / Blocked Bridges",
            "communication_mode": "Cellular 4G",
            "demand": {
                "ambulances": 2,
                "food_packs": 400,
                "medicines": 300,
                "water_liters": 2000,
                "boats": 2,
                "tents": 50
            },
            "reported_at": "10 mins ago"
        },
        {
            "id": "LOC-B",
            "name": "Location B (Flooded Valley - Chamoli East)",
            "lat": 30.3400,
            "lon": 79.1500,
            "condition": "Flash Flood & Water Inundation",
            "affected_people": 320,
            "medical_urgency": 6,  # scale 1-10
            "road_condition": "Partially Submerged / Narrow Roads",
            "communication_mode": "LoRa Gateway (Remote)",
            "lora_metadata": {
                "freq_mhz": 868.1,
                "rssi_dbm": -108,
                "snr_db": 6.8,
                "raw_hex": "4C4F43423A464C4F4F443A504F503332303A4D454436"
            },
            "demand": {
                "ambulances": 2,
                "food_packs": 250,
                "medicines": 180,
                "water_liters": 1200,
                "boats": 1,
                "tents": 80
            },
            "reported_at": "18 mins ago"
        }
    ],
    "hazards": [
        {
            "id": "HAZ-01",
            "name": "Major Landslide - Hill Pass Road",
            "lat": 30.2200,
            "lon": 78.8900,
            "type": "Landslide (Blocked Road)",
            "severity": "CRITICAL_BLOCKAGE",
            "affected_route": "Route 3",
            "clearing_equipment": "JCB / Excavator",
            "is_cleared": False
        }
    ],
    "routes": [
        {
            "id": "ROUTE-1",
            "name": "Route 1 (Primary - Safer Ridge Corridor)",
            "priority": 1,
            "status": "RECOMMENDED",
            "description": "Highest Priority, safe elevated road, bypasses flood plain",
            "distance_km": 34.2,
            "estimated_time_min": 52,
            "risk_score": 14,
            "color": "#10b981", # Emerald
            "path": [
                [30.1450, 78.7800],
                [30.1720, 78.8150],
                [30.2100, 78.8600],
                [30.2450, 78.9100],
                [30.2700, 78.9500],
                [30.2850, 78.9800]
            ]
        },
        {
            "id": "ROUTE-2",
            "name": "Route 2 (Alternative - Valley Bypass)",
            "priority": 2,
            "status": "ALTERNATIVE",
            "description": "Secondary safe option with slight gravel roughness",
            "distance_km": 41.5,
            "estimated_time_min": 68,
            "risk_score": 38,
            "color": "#f59e0b", # Amber
            "path": [
                [30.1450, 78.7800],
                [30.1600, 78.7500],
                [30.1950, 78.7900],
                [30.2300, 78.8500],
                [30.2650, 78.9300],
                [30.2850, 78.9800]
            ]
        },
        {
            "id": "ROUTE-3",
            "name": "Route 3 (Secondary Option - Currently Blocked)",
            "priority": 3,
            "status": "BLOCKED",
            "description": "Direct river gorge highway - BLOCKED by active landslide at Km 22",
            "distance_km": 28.0,
            "estimated_time_min": 0,
            "risk_score": 96,
            "color": "#ef4444", # Red
            "is_blocked": True,
            "block_point": [30.2200, 78.8900],
            "path": [
                [30.1450, 78.7800],
                [30.1800, 78.8300],
                [30.2200, 78.8900], # Landslide point
                [30.2500, 78.9400],
                [30.2850, 78.9800]
            ]
        }
    ],
    "deliveries": [
        {
            "id": "DEL-101",
            "vehicle": "Emergency Ambulance AMB-01",
            "destination": "Location A (Flooded Town)",
            "route": "Route 1 (Primary)",
            "status": "EN_ROUTE",
            "cargo": "Trauma kits & 2 Paramedics",
            "eta_min": 18
        },
        {
            "id": "DEL-102",
            "vehicle": "Heavy Supply Truck TRK-04",
            "destination": "Location A (Flooded Town)",
            "route": "Route 1 (Primary)",
            "status": "DISPATCHED",
            "cargo": "400 Food Packs & 2000L Water",
            "eta_min": 35
        },
        {
            "id": "DEL-103",
            "vehicle": "Emergency Ambulance AMB-02",
            "destination": "Location B (Chamoli East)",
            "route": "Route 2 (Alternative)",
            "status": "EN_ROUTE",
            "cargo": "Pediatric Medicines & Tents",
            "eta_min": 42
        }
    ],
    "driver_logs": [
        {"time": "19:35", "event": "Main Hub dispatched AMB-01 via Route 1 (Safe Corridor)"},
        {"time": "19:38", "event": "LoRa Packet RX: Location B confirmed battery backup online"},
        {"time": "19:42", "event": "Driver TRK-04 cached offline GIS vector map"}
    ]
}

# In-memory working copy
system_state = json.loads(json.dumps(DEFAULT_STATE))

def calculate_ai_severity(location):
    """
    AI Severity & Priority Engine
    Mimics Random Forest Classifier + Explainable Rule Ensemble
    Input features:
      - affected_people (normalized 0-100)
      - medical_urgency (1-10 scaled to 0-100)
      - road_damage factor
      - flood/landslide danger index
    """
    people = float(location.get("affected_people", 100))
    urgency = float(location.get("medical_urgency", 5)) * 10.0
    
    # Non-linear population scaling
    pop_score = min(100.0, (math.log10(max(10, people)) / 3.0) * 100.0)
    
    # Terrain & accessibility penalty
    condition = location.get("condition", "").lower()
    road_cond = location.get("road_condition", "").lower()
    
    hazard_score = 40.0
    if "flood" in condition or "flooded" in condition:
        hazard_score += 35.0
    if "landslide" in condition or "landslide" in road_cond:
        hazard_score += 40.0
    if "blocked" in road_cond or "submerged" in road_cond:
        hazard_score += 20.0
    hazard_score = min(100.0, hazard_score)
    
    # Feature weights (aligned with Image 2 Scikit-learn Random Forest model)
    w_urgency = 0.35
    w_hazard = 0.25
    w_pop = 0.25
    w_isolation = 0.15
    
    isolation_score = 80.0 if "lora" in location.get("communication_mode", "").lower() else 35.0
    
    severity_score = (
        (urgency * w_urgency) +
        (hazard_score * w_hazard) +
        (pop_score * w_pop) +
        (isolation_score * w_isolation)
    )
    severity_score = round(min(100.0, max(1.0, severity_score)), 1)
    
    # Categorization
    if severity_score >= 80:
        tier = "CRITICAL (Immediate Dispatch)"
        badge_color = "red"
        priority_rank = 1
    elif severity_score >= 60:
        tier = "HIGH PRIORITY (Active Allocation)"
        badge_color = "amber"
        priority_rank = 2
    elif severity_score >= 40:
        tier = "MODERATE (Staged Relief)"
        badge_color = "blue"
        priority_rank = 3
    else:
        tier = "LOW / MONITOR"
        badge_color = "slate"
        priority_rank = 4

    return {
        "severity_score": severity_score,
        "priority_tier": tier,
        "priority_rank": priority_rank,
        "breakdown": {
            "medical_urgency_factor": round(urgency, 1),
            "hazard_intensity_factor": round(hazard_score, 1),
            "population_vulnerability": round(pop_score, 1),
            "network_isolation_penalty": round(isolation_score, 1)
        },
        "explainability": f"Score {severity_score}/100 driven by high medical urgency ({urgency:.0f}) and severe road hazard condition ({hazard_score:.0f})."
    }

def solve_resource_allocation():
    """
    Google OR-Tools inspired Constraint Optimization Solver
    Solves multi-objective allocation under strict scarcity:
    Example from Image 1:
      Both Location A and Location B request 2 ambulances.
      Total ambulances available = 3.
      Location A is higher priority -> gets 2 ambulances.
      Location B gets 1 ambulance + Alternative/deferred plan.
    """
    allocations = []
    
    # Evaluate AI scores for all locations
    scored_locs = []
    for loc in system_state["locations"]:
        ai_res = calculate_ai_severity(loc)
        scored_locs.append({
            "loc": loc,
            "ai": ai_res
        })
        
    # Sort by priority (highest severity first)
    scored_locs.sort(key=lambda x: x["ai"]["severity_score"], reverse=True)
    
    # Working pools from inventory
    available_amb = system_state["inventory"]["ambulances"]["total"]
    available_trucks = system_state["inventory"]["trucks"]["total"]
    available_boats = system_state["inventory"]["boats"]["total"]
    available_jcbs = system_state["inventory"]["jcbs"]["total"]
    available_food = system_state["inventory"]["food_packs"]["total"]
    available_meds = system_state["inventory"]["medicines"]["total"]
    available_water = system_state["inventory"]["water_liters"]["total"]
    
    for item in scored_locs:
        loc = item["loc"]
        ai = item["ai"]
        demand = loc.get("demand", {})
        
        req_amb = demand.get("ambulances", 1)
        req_food = demand.get("food_packs", 200)
        req_med = demand.get("medicines", 100)
        req_water = demand.get("water_liters", 1000)
        req_boats = demand.get("boats", 0)
        
        # Priority-aware allocation logic
        # 1. Ambulances
        if available_amb >= req_amb:
            alloc_amb = req_amb
            amb_note = "Full Request Fulfilled"
            available_amb -= alloc_amb
        else:
            alloc_amb = max(1, available_amb) # Give whatever is left
            available_amb -= alloc_amb
            amb_note = f"Constrained: {alloc_amb} Allocated (Alternative Support Plan Activated for remaining {req_amb - alloc_amb})"
            
        # 2. Boats (flood condition check)
        alloc_boats = min(req_boats, available_boats)
        available_boats -= alloc_boats
        
        # 3. Supply allocations
        alloc_food = min(req_food, available_food)
        available_food -= alloc_food
        
        alloc_med = min(req_med, available_meds)
        available_meds -= alloc_med
        
        alloc_water = min(req_water, available_water)
        available_water -= alloc_water
        
        # Vehicle selection based on condition & capacity
        assigned_vehicles = []
        if alloc_amb > 0:
            assigned_vehicles.append(f"{alloc_amb}x Emergency Ambulance (Medical)")
        if alloc_food > 0 or alloc_water > 0:
            assigned_vehicles.append("1x Heavy 6-Wheel Supply Truck")
        if alloc_boats > 0:
            assigned_vehicles.append(f"{alloc_boats}x Inflatable Motor Rescue Boat")
        if "landslide" in loc.get("condition", "").lower() or "landslide" in loc.get("road_condition", "").lower():
            assigned_vehicles.append("1x JCB / Excavator (Road Clearance)")
            
        allocations.append({
            "location_id": loc["id"],
            "location_name": loc["name"],
            "priority_rank": ai["priority_rank"],
            "severity_score": ai["severity_score"],
            "allocated_resources": {
                "ambulances": alloc_amb,
                "food_packs": alloc_food,
                "medicines": alloc_med,
                "water_liters": alloc_water,
                "boats": alloc_boats
            },
            "shortfall_notes": amb_note,
            "assigned_vehicles": assigned_vehicles,
            "alternative_plan": "Scheduled for Batch 2 Air-Drop / 4x4 Quick-Response" if alloc_amb < req_amb else "Primary ground transit operational"
        })
        
    return allocations

class DisasterAppHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            # Enrich locations with AI severity scores
            enriched_locs = []
            for loc in system_state["locations"]:
                c = dict(loc)
                c["ai_analysis"] = calculate_ai_severity(loc)
                enriched_locs.append(c)
                
            response_data = {
                "hub": system_state["hub"],
                "inventory": system_state["inventory"],
                "locations": enriched_locs,
                "hazards": system_state["hazards"],
                "routes": system_state["routes"],
                "deliveries": system_state["deliveries"],
                "driver_logs": system_state["driver_logs"]
            }
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return

        elif path == "/api/routes":
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(system_state["routes"]).encode('utf-8'))
            return

        elif path == "/api/optimize":
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            allocations = solve_resource_allocation()
            self.wfile.write(json.dumps({"status": "SUCCESS", "optimization": allocations}).encode('utf-8'))
            return

        # Static file handling
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else "{}"
        
        try:
            payload = json.loads(post_body)
        except Exception:
            payload = {}

        if path == "/api/report":
            # Field Assessment & Reporting ingestion (Module 1 & 2)
            name = payload.get("name", "Field Sector")
            lat = float(payload.get("lat", 30.25))
            lon = float(payload.get("lon", 78.90))
            condition = payload.get("condition", "Flooded Area")
            people = int(payload.get("affected_people", 250))
            urgency = int(payload.get("medical_urgency", 7))
            comm_mode = payload.get("communication_mode", "Cellular 4G")
            road_cond = payload.get("road_condition", "Partially Blocked")
            
            new_id = f"LOC-{chr(65 + len(system_state['locations']))}"
            new_loc = {
                "id": new_id,
                "name": f"{new_id} ({name})",
                "lat": lat,
                "lon": lon,
                "condition": condition,
                "affected_people": people,
                "medical_urgency": urgency,
                "road_condition": road_cond,
                "communication_mode": comm_mode,
                "demand": {
                    "ambulances": int(payload.get("req_ambulances", 1)),
                    "food_packs": int(payload.get("req_food", 200)),
                    "medicines": int(payload.get("req_meds", 150)),
                    "water_liters": int(payload.get("req_water", 1000)),
                    "boats": int(payload.get("req_boats", 1 if "flood" in condition.lower() else 0)),
                    "tents": 40
                },
                "reported_at": "Just now"
            }
            
            if "lora" in comm_mode.lower():
                hex_msg = "".join(f"{ord(c):02X}" for c in f"{new_id}:{condition[:5]}:{people}")
                new_loc["lora_metadata"] = {
                    "freq_mhz": 868.3,
                    "rssi_dbm": -112,
                    "snr_db": 5.4,
                    "raw_hex": hex_msg[:32]
                }
                
            system_state["locations"].append(new_loc)
            system_state["driver_logs"].insert(0, {
                "time": time.strftime("%H:%M"),
                "event": f"New Field Report Received from {new_loc['name']} via {comm_mode}"
            })
            
            ai_score = calculate_ai_severity(new_loc)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "SUCCESS",
                "location": new_loc,
                "ai_score": ai_score
            }).encode('utf-8'))
            return

        elif path == "/api/ai/severity":
            # Direct calculation endpoint for AI scoring module
            ai_res = calculate_ai_severity(payload)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(ai_res).encode('utf-8'))
            return

        elif path == "/api/driver/incident":
            # Driver Execution & Incident Reporting Feedback Loop (Image 2 Module 8 & 9)
            # When driver reports a hazard, Route is blocked, and feedback updates hub
            incident_type = payload.get("type", "Severe Landslide / Blockage")
            route_id = payload.get("route_id", "ROUTE-1")
            driver_name = payload.get("driver", "Driver Unit 01")
            
            # Find and update route status
            target_route = None
            for r in system_state["routes"]:
                if r["id"] == route_id:
                    target_route = r
                    r["status"] = "BLOCKED"
                    r["is_blocked"] = True
                    r["risk_score"] = 99
                    r["color"] = "#ef4444"
                    r["description"] = f"CRITICAL HAZARD: Reported by {driver_name} - Recalculated!"
                    
            # Switch other routes to safe alternative
            for r in system_state["routes"]:
                if r["id"] != route_id and not r.get("is_blocked"):
                    r["status"] = "RECOMMENDED (RE-ROUTED)"
                    r["color"] = "#10b981"
                    
            timestamp = time.strftime("%H:%M")
            system_state["driver_logs"].insert(0, {
                "time": timestamp,
                "event": f"⚠️ INCIDENT REPORT: {driver_name} reported {incident_type} on {route_id}! Hub recalculated active fleet routes."
            })
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "INCIDENT_RECORDED",
                "message": f"Route {route_id} closed. Dynamic re-routing broadcast to fleet.",
                "routes": system_state["routes"]
            }).encode('utf-8'))
            return

        elif path == "/api/reset":
            # Reset to original state
            system_state.clear()
            system_state.update(json.loads(json.dumps(DEFAULT_STATE)))
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "RESET_SUCCESS"}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def run():
    # Set proper mimetypes
    mimetypes.init()
    mimetypes.add_type('application/javascript', '.js')
    mimetypes.add_type('text/css', '.css')
    mimetypes.add_type('text/html', '.html')
    mimetypes.add_type('application/json', '.json')
    
    server_address = ('', PORT)
    try:
        httpd = socketserver.TCPServer(server_address, DisasterAppHandler)
        print(f"\n==================================================================")
        print(f"  AI Intelligent Disaster Logistics & Transportation Server")
        print(f"  Status: Active & Listening on http://localhost:{PORT}")
        print(f"  Command Center Web UI: http://localhost:{PORT}/index.html")
        print(f"==================================================================\n")
        httpd.serve_forever()
    except OSError as e:
        print(f"Port {PORT} busy, trying 8080...")
        httpd = socketserver.TCPServer(('', 8080), DisasterAppHandler)
        print(f"Active & Listening on http://localhost:8080")
        httpd.serve_forever()

if __name__ == "__main__":
    run()
