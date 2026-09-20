"""
FastAPI Implementation for AI Intelligent Disaster Logistics & Transportation
Meets Technical Approach in Image 2:
- FastAPI + Python Backend / API
- Scikit-learn Random Forest Severity Scoring
- OR-Tools Resource Optimization
- Dynamic Disaster-Aware Routing
"""

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import os
import json

app = FastAPI(
    title="AI Intelligent Disaster Logistics & Transportation API",
    description="Backend API for Field reports, AI Severity scoring, OR-Tools resource allocation, and Disaster-Aware Routing",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class FieldReportInput(BaseModel):
    name: str = Field(..., example="Flooded Valley Sector")
    lat: float = Field(..., example=30.285)
    lon: float = Field(..., example=78.980)
    condition: str = Field(..., example="Flooded Area & Bridge Submerged")
    affected_people: int = Field(..., example=500)
    medical_urgency: int = Field(..., ge=1, le=10, example=8)
    road_condition: str = Field(..., example="Submerged / Blocked Bridges")
    communication_mode: str = Field(default="Cellular 4G", example="LoRa Gateway (Remote)")
    req_ambulances: int = 2
    req_food: int = 300
    req_meds: int = 200
    req_water: int = 1500
    req_boats: int = 1

class SeverityEvaluationRequest(BaseModel):
    affected_people: int
    medical_urgency: int
    condition: str
    road_condition: str
    communication_mode: Optional[str] = "Cellular"

class DriverIncidentReport(BaseModel):
    driver: str = "Driver AMB-01"
    route_id: str = "ROUTE-1"
    type: str = "New Landslide Blockage Detected"
    coordinates: Optional[List[float]] = [30.21, 78.86]

# In-memory store
from app import system_state, calculate_ai_severity, solve_resource_allocation, DEFAULT_STATE

@app.get("/api/status")
def get_system_status():
    enriched_locs = []
    for loc in system_state["locations"]:
        c = dict(loc)
        c["ai_analysis"] = calculate_ai_severity(loc)
        enriched_locs.append(c)
    return {
        "hub": system_state["hub"],
        "inventory": system_state["inventory"],
        "locations": enriched_locs,
        "hazards": system_state["hazards"],
        "routes": system_state["routes"],
        "deliveries": system_state["deliveries"],
        "driver_logs": system_state["driver_logs"]
    }

@app.post("/api/report")
def submit_field_report(report: FieldReportInput):
    data = report.model_dump()
    new_id = f"LOC-{chr(65 + len(system_state['locations']))}"
    new_loc = {
        "id": new_id,
        "name": f"{new_id} ({data['name']})",
        "lat": data["lat"],
        "lon": data["lon"],
        "condition": data["condition"],
        "affected_people": data["affected_people"],
        "medical_urgency": data["medical_urgency"],
        "road_condition": data["road_condition"],
        "communication_mode": data["communication_mode"],
        "demand": {
            "ambulances": data["req_ambulances"],
            "food_packs": data["req_food"],
            "medicines": data["req_meds"],
            "water_liters": data["req_water"],
            "boats": data["req_boats"],
            "tents": 50
        },
        "reported_at": "Just now"
    }
    if "lora" in data["communication_mode"].lower():
        hex_msg = "".join(f"{ord(c):02X}" for c in f"{new_id}:{data['condition'][:5]}:{data['affected_people']}")
        new_loc["lora_metadata"] = {
            "freq_mhz": 868.3,
            "rssi_dbm": -114,
            "snr_db": 5.2,
            "raw_hex": hex_msg[:32]
        }
    system_state["locations"].append(new_loc)
    ai_score = calculate_ai_severity(new_loc)
    return {"status": "SUCCESS", "location": new_loc, "ai_score": ai_score}

@app.post("/api/ai/severity")
def evaluate_severity(req: SeverityEvaluationRequest):
    return calculate_ai_severity(req.model_dump())

@app.get("/api/optimize")
def get_resource_optimization():
    allocations = solve_resource_allocation()
    return {"status": "SUCCESS", "optimization": allocations}

@app.get("/api/routes")
def get_routes():
    return system_state["routes"]

@app.post("/api/driver/incident")
def report_driver_incident(incident: DriverIncidentReport):
    for r in system_state["routes"]:
        if r["id"] == incident.route_id:
            r["status"] = "BLOCKED"
            r["is_blocked"] = True
            r["risk_score"] = 99
            r["color"] = "#ef4444"
            r["description"] = f"HAZARD: Reported by {incident.driver} - Recalculated!"
            
    for r in system_state["routes"]:
        if r["id"] != incident.route_id and not r.get("is_blocked"):
            r["status"] = "RECOMMENDED (RE-ROUTED)"
            r["color"] = "#10b981"
            
    return {"status": "INCIDENT_RECORDED", "routes": system_state["routes"]}

@app.post("/api/reset")
def reset_simulation():
    global system_state
    system_state.clear()
    system_state.update(json.loads(json.dumps(DEFAULT_STATE)))
    return {"status": "RESET_SUCCESS"}

# Serve static web dashboard
STATIC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.exists(STATIC_PATH):
    app.mount("/", StaticFiles(directory=STATIC_PATH, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_fastapi:app", host="0.0.0.0", port=8000, reload=True)
