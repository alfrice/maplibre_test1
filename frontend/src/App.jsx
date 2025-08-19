import {useEffect, useRef, useState} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const busses_url = `https://developer.trimet.org/ws/v2/vehicles/hasTripId/true?json=true&appId=8CBD14D520C6026CC7EEE56A9&bbox=-122.71990263086556%2C45.512031130666486%2C-122.66497099024063%2C45.52796774085945`


const updateBusLocations = async () => {
  if (!map.current) return;

  // Get current map bounds
  const bounds = map.current.getBounds(); // returns LngLatBounds
  const sw = bounds.getSouthWest(); // southwest corner
  const ne = bounds.getNorthEast(); // northeast corner

  // Format bbox for TriMet API: minLon,minLat,maxLon,maxLat
  const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;

  // Remove previous bus source if exists
  if (map.current.getSource("buses")) {
    map.current.removeLayer("buses");
    map.current.removeSource("buses");
  }

  // Add new source for buses
  map.current.addSource("buses", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });

  // Add layer to display buses as circles
  map.current.addLayer({
    id: "buses",
    type: "circle",
    source: "buses",
    paint: {
      "circle-radius": 6,
      "circle-color": "#FF0000",
      "circle-opacity": 0.8,
    },
  });

  // Fetch buses from backend with bbox query param
  const res = await fetch(`http://localhost:8000/realtime-buses?bbox=${bbox}`);
  const buses = await res.json();

  const geojson = {
    type: "FeatureCollection",
    features: buses.map((bus) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [bus.longitude, bus.latitude],
      },
      properties: {
        routeNumber: bus.routeNumber,
        signMessage: bus.signMessage,
        vehicleID: bus.vehicleID,
        bearing: bus.bearing,
      },
    })),
  };

  if (map.current.getSource("buses")) {
    map.current.getSource("buses").setData(geojson);
  }
};



function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [styleUrl, setStyleUrl] = useState(null);

  useEffect(() => {
    if (!map.current) return;

    updateBusLocations(); // initial fetch
    const interval = setInterval(updateBusLocations, 30000);
    return () => clearInterval(interval);
  }, []);


  // Get base style (from FastAPI)
  useEffect(() => {
    fetch("http://localhost:8000/tileserver-url")
        .then((res) => res.json())
        .then((data) => setStyleUrl(data.style));
  }, []);

  useEffect(() => {
    if (map.current || !styleUrl) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [-122.679565, 45.512794], // Portland
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      // Add TriMet stops/stations vector source
      map.current.addSource("trimet", {
        type: "vector",
        url: "https://ws-st.trimet.org/rtp/routers/default/vectorTiles/stops,stations,areaStops,rentalVehicles,rentalVehicles,rentalStations/tilejson.json",
      });

      // Example: add stops as circles
      map.current.addLayer({
        id: "trimet-stops",
        type: "circle",
        source: "trimet",
        "source-layer": "stops",   // name must match one of the TileJSON layers
        paint: {
          "circle-radius": 4,
          "circle-color": "rgba(26,67,179,0.6)",
        },
      });

      // Example: add stations as bigger circles
      map.current.addLayer({
        id: "trimet-stations",
        type: "circle",
        source: "trimet",
        "source-layer": "stations",
        paint: {
          "circle-radius": 10,
          "circle-color": "rgba(255,21,0,0.57)",
        },
      });
    });
  }, [styleUrl]);

  return <div id="map-container" ref={mapContainer}></div>;
}

export default App;
