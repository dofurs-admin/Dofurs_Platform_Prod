'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

type LocationPinMapProps = {
  latitude: string;
  longitude: string;
  currentLatitude?: string;
  currentLongitude?: string;
  onChange: (lat: number, lng: number) => void;
};

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

const markerIcon = new L.Icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const currentLocationDotIcon = L.divIcon({
  className: 'dofurs-current-location-dot',
  html: '<span class="dofurs-current-location-dot-inner"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function ClickToDropPin({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });
  }, [map, lat, lng]);
  return null;
}

export default function LocationPinMap({ latitude, longitude, currentLatitude = '', currentLongitude = '', onChange }: LocationPinMapProps) {
  const latValue = Number(latitude);
  const lngValue = Number(longitude);
  const hasCoordinates = Number.isFinite(latValue) && Number.isFinite(lngValue) && latValue !== 0 && lngValue !== 0;
  const liveLatValue = Number(currentLatitude);
  const liveLngValue = Number(currentLongitude);
  const hasLiveCoordinates = Number.isFinite(liveLatValue) && Number.isFinite(liveLngValue) && liveLatValue !== 0 && liveLngValue !== 0;

  const center = useMemo<[number, number]>(
    () => (hasCoordinates ? [latValue, lngValue] : DEFAULT_CENTER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const isTouchDevice =
    typeof window !== 'undefined' && ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
  const allowMapGesturePan = !isTouchDevice;

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-xl border border-neutral-200/80"
        style={isTouchDevice ? { touchAction: 'pan-y' } : undefined}
      >
        <MapContainer
          center={center}
          zoom={hasCoordinates ? 16 : 12}
          style={{ height: '240px', width: '100%', touchAction: isTouchDevice ? 'pan-y' : 'auto' }}
          scrollWheelZoom={false}
          dragging={allowMapGesturePan}
          touchZoom={allowMapGesturePan}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <InvalidateSize />
          <ClickToDropPin onChange={onChange} />
          {hasCoordinates ? (
            <>
              <RecenterMap lat={latValue} lng={lngValue} />
              <Marker
                position={[latValue, lngValue]}
                icon={markerIcon}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const marker = event.target as L.Marker;
                    const next = marker.getLatLng();
                    onChange(next.lat, next.lng);
                  },
                }}
              />
            </>
          ) : null}
          {hasLiveCoordinates ? (
            <Marker position={[liveLatValue, liveLngValue]} icon={currentLocationDotIcon} interactive={false} />
          ) : null}
        </MapContainer>
      </div>
      <p className="text-xs text-neutral-500">Drop pin by clicking on the map or drag the marker to fine-tune.</p>
    </div>
  );
}
