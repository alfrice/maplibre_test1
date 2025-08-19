import {useEffect, useRef, useState} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function App() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [styleUrl, setStyleUrl] = useState(null);

    // Fetch base style from FastAPI
    useEffect(() => {
        fetch("http://localhost:8000/tileserver-url")
            .then((res) => res.json())
            .then((data) => setStyleUrl(data.style));
    }, []);

    // Initialize MapLibre map once styleUrl is ready
    useEffect(() => {
        if (!styleUrl || map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: styleUrl,
            center: [-122.679565, 45.512794], // Portland
            zoom: 12,
        });

        map.current.addControl(new maplibregl.NavigationControl(), "top-right");

        map.current.on("load", () => {
            // TriMet stops & stations
            map.current.addSource("trimet", {
                type: "vector",
                url: "https://ws-st.trimet.org/rtp/routers/default/vectorTiles/stops,stations,areaStops,rentalVehicles,rentalVehicles,rentalStations/tilejson.json",
            });

            map.current.addLayer({
                id: "trimet-stops",
                type: "circle",
                source: "trimet",
                "source-layer": "stops",
                paint: {"circle-radius": 4, "circle-color": "rgba(26,67,179,0.6)"},
            });

            map.current.addLayer({
                id: "trimet-stations",
                type: "circle",
                source: "trimet",
                "source-layer": "stations",
                paint: {"circle-radius": 10, "circle-color": "rgba(255,21,0,0.57)"},
            });

            // Initialize empty buses source & layer
            map.current.addSource("buses", {
                type: "geojson",
                data: {type: "FeatureCollection", features: []},
            });

            map.current.addLayer({
                id: "buses",
                type: "circle",
                source: "buses",
                paint: {
                    "circle-radius": 8,
                    "circle-color": [
                        "match",
                        ["get", "routeNumber"],
                        9, "#66ff00",
                        17, "#00f887",
                        "#de00ff" // default color
                    ],
                    "circle-opacity": 0.9,
                },
            });

            map.current.on("click", "buses", (e) => {
                const props = e.features[0].properties;
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`<strong>Route ${props.routeNumber}</strong><br>${props.signMessage}`)
                    .addTo(map.current);
            });

            console.log(map.current)
            const fetchBuses = async () => {
                const bounds = map.current.getBounds();
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();
                const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
                console.log("fetch busses", map)

                try {
                    const res = await fetch(`http://localhost:8000/realtime-buses?bbox=${bbox}`);
                    console.log(res)
                    const buses = await res.json();

                    const geojson = {
                        type: "FeatureCollection",
                        features: buses.map(bus => ({
                            type: "Feature",
                            geometry: {type: "Point", coordinates: [bus.longitude, bus.latitude]},
                            properties: {routeNumber: bus.routeNumber, signMessage: bus.signMessage}
                        }))
                    };

                    map.current.getSource("buses").setData(geojson);


                } catch (err) {
                    console.error(err);
                }
            };

            fetchBuses(); // initial fetch
            const interval = setInterval(fetchBuses, 5000);
            return () => clearInterval(interval);
        });


    }, [styleUrl]);


    // Update bus locations every 30 seconds based on map viewport


    return <div ref={mapContainer} style={{width: "100vw", height: "100vh"}}></div>;
}

export default App;
