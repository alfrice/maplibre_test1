from fastapi import FastAPI, Query
import requests
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TRIMET_APP_ID = "8CBD14D520C6026CC7EEE56A9"

@app.get("/realtime-buses")
def realtime_buses(bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat")):
    url = f"https://developer.trimet.org/ws/v2/vehicles/hasTripId/true?json=true&appId={TRIMET_APP_ID}&bbox={bbox}"
    res = requests.get(url)
    data = res.json()
    buses = data.get("resultSet", {}).get("vehicle", [])
    return buses


@app.get("/ping")
def ping():
    return {"msg": "pong"}

@app.get("/tileserver-url")
def tileserver_url():
    return {"style": "https://tiles-st.trimet.org/styles/rtp/style.json"}
