import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom vessel icon builder
const createVesselIcon = (heading = 0, isMoving = false, isStale = false) => {
    // Se il dato è vecchio (>12h), usiamo Ambra per avvertire l'utente.
    // Altrimenti Blu se in movimento, Grigio se fermo.
    let color = isMoving ? '#3b82f6' : '#64748b';
    if (isStale) color = '#f59e0b'; // Ambra/Arancio per dati obsoleti

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" transform="rotate(${heading})">
        <path d="M12 2 L8 20 L12 17 L16 20 Z"/>
    </svg>`;
    return L.divIcon({
        html: svg,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
};

// Geofence nature → color
const geoColor = (nature) => {
    const map = {
        'loading_site': '#10b981',
        'unloading_site': '#f59e0b',
        'anchorage': '#8b5cf6',
        'port': '#3b82f6',
        'rada': '#6366f1',
        'mooring': '#06b6d4'
    };
    return map[nature?.toLowerCase()] || '#64748b';
};

export default function VesselMap({ geofences = [], vesselPositions = [], height = '100%' }) {
    // Parse polygon coords safely
    const parsedGeofences = useMemo(() => {
        return geofences.map(g => {
            try {
                const coords = typeof g.polygon_coords === 'string'
                    ? JSON.parse(g.polygon_coords)
                    : g.polygon_coords;
                if (Array.isArray(coords) && coords.length >= 3) {
                    return { ...g, parsedCoords: coords };
                }
            } catch { /* skip malformed */ }
            return null;
        }).filter(Boolean);
    }, [geofences]);

    // Valid vessel positions only - Simple check
    const validPositions = (vesselPositions || []).filter(p => p && p.lat && p.lon);

    // Force map resize fix
    const InvalidateMap = () => {
        const map = useMap();
        React.useEffect(() => {
            const timer = setTimeout(() => map.invalidateSize(), 800);
            return () => clearTimeout(timer);
        }, [map]);
        return null;
    };

    // Set center fixed to Genova area
    const center = [44.0, 9.0];

    return (
        <MapContainer
            center={center}
            zoom={8}
            style={{ height, width: '100%', borderRadius: '16px' }}
            zoomControl={false}
            className="map-tiles-contrast"
        >
            <InvalidateMap />
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; CartoDB'
            />

            {/* Geofence polygons */}
            {parsedGeofences.map(g => (
                <Polygon
                    key={g.id}
                    positions={g.parsedCoords}
                    pathOptions={{
                        color: geoColor(g.nature),
                        fillColor: geoColor(g.nature),
                        fillOpacity: 0.15,
                        weight: 2
                    }}
                >
                    <Popup>
                        <strong>{g.name}</strong><br />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {g.nature || 'General'}
                        </span>
                    </Popup>
                </Polygon>
            ))}

            {/* Vessel markers */}
            {validPositions.map(pos => (
                <Marker
                    key={pos.vessel}
                    position={[pos.lat, pos.lon]}
                    icon={createVesselIcon(pos.heading, pos.speed > 0.8, pos.isStale)}
                >
                    <Popup>
                        <strong>{pos.vessel}</strong><br />
                        <span style={{ fontSize: '11px' }}>
                            Speed: {pos.speed?.toFixed(1)} kn<br />
                            Status: {pos.status}<br />
                            Last Update: {new Date(pos.lastUpdate).toLocaleString('en-GB')}<br />
                            {pos.isStale && <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>● Offline ({'>'}12h)</span>}
                        </span>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
