'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/navigation';
import { Store, ExternalLink } from 'lucide-react';

// Fix Leaflet default icon broken by webpack
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface ShopPin {
  id: string;
  shop_name: string;
  owner_name?: string;
  municipality?: string;
  ward_no?: string;
  gps_lat: number;
  gps_lng: number;
  compliance_score?: number;
  compliance_tier?: number;
  status: string;
}

export type MapView = 'pins' | 'heat' | 'wards';
export type MapStyle = 'dark' | 'light' | 'satellite';

function getTileUrl(style: MapStyle): string {
  if (style === 'light') return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  if (style === 'satellite') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
}

export function getPinColor(shop: ShopPin): string {
  const tier = shop.compliance_tier;
  if (tier === 1 || tier === 2) return '#22c55e';
  if (tier === 3) return '#f59e0b';
  if (tier === 4) return '#ef4444';
  return '#64748b';
}

export function getStatusLabel(shop: ShopPin): { label: string; bg: string; text: string } {
  const tier = shop.compliance_tier;
  if (tier === 1 || tier === 2) return { label: 'compliant', bg: 'bg-emerald-100', text: 'text-emerald-700' };
  if (tier === 3) return { label: 'partial', bg: 'bg-amber-100', text: 'text-amber-700' };
  if (tier === 4) return { label: 'non compliant', bg: 'bg-red-100', text: 'text-red-700' };
  return { label: 'pending', bg: 'bg-slate-100', text: 'text-slate-600' };
}

export function getRiskLabel(shop: ShopPin): { label: string; bg: string; text: string } {
  const s = shop.compliance_score ?? 0;
  if (shop.compliance_score === undefined) return { label: 'unknown', bg: 'bg-slate-100', text: 'text-slate-500' };
  if (s >= 70) return { label: 'low risk', bg: 'bg-green-100', text: 'text-green-700' };
  if (s >= 40) return { label: 'medium risk', bg: 'bg-amber-100', text: 'text-amber-700' };
  return { label: 'high risk', bg: 'bg-red-100', text: 'text-red-700' };
}

// ─── Tile layer re-renderer on style change ───────────────────────────────────

function TileLayerSwitcher({ style }: { style: MapStyle }) {
  return (
    <TileLayer
      key={style}
      url={getTileUrl(style)}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    />
  );
}

// ─── Shop Popup ───────────────────────────────────────────────────────────────

function ShopPopupCard({ shop, onClose }: { shop: ShopPin; onClose: () => void }) {
  const router = useRouter();
  const status = getStatusLabel(shop);
  const risk = getRiskLabel(shop);

  return (
    <div className="bg-white rounded-xl shadow-xl p-4 min-w-[240px] relative pointer-events-auto">
      <button
        onClick={onClose}
        className="absolute top-2 right-3 text-slate-400 hover:text-slate-600 text-xl leading-none font-light"
      >
        ×
      </button>
      <div className="flex items-center gap-3 mb-3 pr-4">
        <div className="bg-slate-100 rounded-lg p-3 w-12 h-12 flex items-center justify-center flex-shrink-0">
          <Store className="w-5 h-5 text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className="text-slate-900 font-bold text-base leading-tight truncate">{shop.shop_name}</p>
          {shop.owner_name && <p className="text-cyan-600 text-sm truncate">{shop.owner_name}</p>}
          <p className="text-slate-500 text-xs">
            {[shop.municipality, shop.ward_no ? `Ward ${shop.ward_no}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${status.bg} ${status.text}`}>
          {status.label}
        </span>
        {shop.compliance_score !== undefined && (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
            {shop.compliance_score}%
          </span>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${risk.bg} ${risk.text}`}>
          {risk.label}
        </span>
      </div>
      <button
        onClick={() => router.push(`/shops/${shop.id}`)}
        className="w-full bg-slate-900 hover:bg-slate-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        View Full Profile
      </button>
    </div>
  );
}

// ─── Map Canvas ───────────────────────────────────────────────────────────────

interface MapCanvasProps {
  shops: ShopPin[];
  mapView: MapView;
  mapStyle: MapStyle;
  selectedShop: ShopPin | null;
  onShopClick: (shop: ShopPin) => void;
  onClosePopup: () => void;
}

export default function MapCanvas({
  shops, mapView, mapStyle, selectedShop, onShopClick, onClosePopup,
}: MapCanvasProps) {

  function makePinIcon(color: string) {
    return L.divIcon({
      className: '',
      html: `<div style="width:28px;height:34px">
        <svg viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.55))">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 20 14 20s14-10.667 14-20C28 6.268 21.732 0 14 0z" fill="${color}"/>
          <circle cx="14" cy="13" r="5" fill="white" opacity="0.9"/>
        </svg>
      </div>`,
      iconSize: [28, 34],
      iconAnchor: [14, 34],
      popupAnchor: [0, -36],
    });
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={[-29.5, 30.8]}
        zoom={10}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <TileLayerSwitcher style={mapStyle} />

        {mapView === 'pins' && shops.map(shop => (
          <Marker
            key={shop.id}
            position={[shop.gps_lat, shop.gps_lng]}
            icon={makePinIcon(getPinColor(shop))}
            eventHandlers={{ click: () => onShopClick(shop) }}
          />
        ))}

        {mapView === 'heat' && shops.map(shop => {
          const color = getPinColor(shop);
          return (
            <CircleMarker
              key={shop.id}
              center={[shop.gps_lat, shop.gps_lng]}
              radius={24}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2, opacity: 0.6 }}
              eventHandlers={{ click: () => onShopClick(shop) }}
            />
          );
        })}

        {mapView === 'wards' && shops.map(shop => (
          <CircleMarker
            key={shop.id}
            center={[shop.gps_lat, shop.gps_lng]}
            radius={14}
            pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.2, weight: 3 }}
            eventHandlers={{ click: () => onShopClick(shop) }}
          />
        ))}
      </MapContainer>

      {/* Popup overlay */}
      {selectedShop && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-max max-w-[90vw]">
          <ShopPopupCard shop={selectedShop} onClose={onClosePopup} />
        </div>
      )}
    </div>
  );
}
