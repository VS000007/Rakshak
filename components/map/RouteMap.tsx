"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix missing marker icons in leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface RouteMapProps {
  sourceCoords?: { lat: number; lng: number };
  destCoords?: { lat: number; lng: number };
  routePath?: [number, number][]; // Array of [lat, lng]
}

function MapUpdater({ sourceCoords, destCoords }: { sourceCoords?: { lat: number; lng: number }, destCoords?: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (sourceCoords && destCoords) {
      const bounds = L.latLngBounds(
        [sourceCoords.lat, sourceCoords.lng],
        [destCoords.lat, destCoords.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (sourceCoords) {
      map.setView([sourceCoords.lat, sourceCoords.lng], 14);
    }
  }, [sourceCoords, destCoords, map]);
  return null;
}

export default function RouteMap({ sourceCoords, destCoords, routePath }: RouteMapProps) {
  const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // Default to India center
  const center = sourceCoords || defaultCenter;

  // Mock Safe Zones around source (e.g., Police Stations, Hospitals)
  const safeZones = sourceCoords ? [
    { lat: sourceCoords.lat + 0.005, lng: sourceCoords.lng + 0.005, type: 'Police Station' },
    { lat: sourceCoords.lat - 0.004, lng: sourceCoords.lng - 0.003, type: 'Hospital' },
  ] : [];

  return (
    <div className="w-full h-[300px] rounded-xl overflow-hidden border border-white/10 shadow-lg relative z-0">
      <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Render Safe Zones */}
        {safeZones.map((zone, idx) => (
          <Circle 
            key={idx} 
            center={[zone.lat, zone.lng]} 
            radius={300} 
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }}
          >
            <Popup>Safe Zone: {zone.type}</Popup>
          </Circle>
        ))}

        {sourceCoords && (
          <Marker position={[sourceCoords.lat, sourceCoords.lng]}>
            <Popup>Live Current Location</Popup>
          </Marker>
        )}
        {destCoords && (
          <Marker position={[destCoords.lat, destCoords.lng]}>
            <Popup>Destination</Popup>
          </Marker>
        )}
        {routePath && routePath.length > 0 && (
          <Polyline positions={routePath} color="red" weight={5} opacity={0.7} />
        )}
        <MapUpdater sourceCoords={sourceCoords} destCoords={destCoords} />
      </MapContainer>
    </div>
  );
}
