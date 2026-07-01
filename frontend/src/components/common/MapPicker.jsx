import React, { useEffect, useRef, useState } from 'react';
import { MapPin, MagnifyingGlass } from '@phosphor-icons/react';

export default function MapPicker({ latitude, longitude, radius, onChange }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initializing Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    const L = window.L;

    // Fix default marker icon assets from Leaflet CDN issue
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const initLat = latitude || 10.7769;
    const initLng = longitude || 106.7009;

    // Create Map instance
    const map = L.map(mapContainerRef.current).setView([initLat, initLng], 15);
    mapRef.current = map;

    // Add Tile Layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Create draggable marker
    const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    // Create radius circles
    const circle = L.circle([initLat, initLng], {
      color: '#76b900',
      fillColor: '#76b900',
      fillOpacity: 0.15,
      radius: radius || 100
    }).addTo(map);
    circleRef.current = circle;

    // Listen to dragend on marker
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      updateCoords(position.lat, position.lng);
    });

    // Listen to click on map to move marker
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      updateCoords(lat, lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map elements when coordinates or radius changes from inputs
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    
    const lat = latitude || 10.7769;
    const lng = longitude || 106.7009;
    const r = radius || 100;

    const currentMarkerLatLng = markerRef.current.getLatLng();
    if (currentMarkerLatLng.lat !== lat || currentMarkerLatLng.lng !== lng) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.panTo([lat, lng]);
    }

    circleRef.current.setLatLng([lat, lng]);
    circleRef.current.setRadius(r);
  }, [latitude, longitude, radius]);

  const updateCoords = (lat, lng) => {
    // Keep 6 decimal points precision
    const precisionLat = parseFloat(lat.toFixed(6));
    const precisionLng = parseFloat(lng.toFixed(6));
    onChange(precisionLat, precisionLng);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setErrorMsg('');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);

        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([newLat, newLng], 16);
          markerRef.current.setLatLng([newLat, newLng]);
          updateCoords(newLat, newLng);
        }
      } else {
        setErrorMsg('Không tìm thấy địa điểm này. Vui lòng thử tìm kiếm lại.');
      }
    } catch (err) {
      console.error('Map search error:', err);
      setErrorMsg('Lỗi kết nối dịch vụ tìm kiếm bản đồ.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="map-picker-wrapper" style={{ margin: 'var(--space-md) 0' }}>
      <label style={{ display: 'block', fontWeight: '600', marginBottom: 'var(--space-xs)' }}>
        Định vị chi nhánh trên bản đồ:
      </label>

      {/* Map Search input */}
      <div className="map-search-bar" style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
        <input
          type="text"
          placeholder="Tìm địa chỉ (ví dụ: 135 Nguyễn Huệ, HCMC)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: 'var(--space-sm)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-canvas)',
            color: 'var(--color-ink)'
          }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', padding: '0 var(--space-md)' }}
        >
          {searching ? 'Đang tìm...' : <><MagnifyingGlass size={16} /> Tìm</>}
        </button>
      </div>

      {errorMsg && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', margin: 'var(--space-xs) 0' }}>
          {errorMsg}
        </p>
      )}

      {/* Leaflet container */}
      <div
        ref={mapContainerRef}
        style={{
          height: '280px',
          width: '100%',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-hairline)',
          zIndex: 10,
          position: 'relative'
        }}
      />
      <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginTop: 'var(--space-xs)', display: 'block' }}>
        * Kéo thả ghim đỏ hoặc click trên bản đồ để cập nhật tọa độ chính xác.
      </span>
    </div>
  );
}
