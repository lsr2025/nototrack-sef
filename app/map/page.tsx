'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase';
import {
  MapPin, Activity, Circle, Filter, Users, Store,
  ChevronLeft, ChevronRight, ArrowLeft, TriangleAlert,
  CheckCircle2, BarChart2, Focus, ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopPin {
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

interface AgentRow {
  id: string;
  full_name: string;
  municipality?: string;
}

type MapView = 'pins' | 'heat' | 'wards';
type MapStyle = 'dark' | 'light' | 'satellite';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPinColor(shop: ShopPin): string {
  if (!shop.compliance_score && shop.status !== 'synced') return '#64748b';
  const tier = shop.compliance_tier;
  if (tier === 1 || tier === 2) return '#22c55e';
  if (tier === 3) return '#f59e0b';
  if (tier === 4) return '#ef4444';
  return '#64748b';
}

function getStatusLabel(shop: ShopPin): { label: string; bg: string; text: string } {
  const tier = shop.compliance_tier;
  if (tier === 1 || tier === 2) return { label: 'compliant', bg: 'bg-emerald-100', text: 'text-emerald-700' };
  if (tier === 3) return { label: 'partial', bg: 'bg-amber-100', text: 'text-amber-700' };
  if (tier === 4) return { label: 'non compliant', bg: 'bg-red-100', text: 'text-red-700' };
  return { label: 'pending', bg: 'bg-slate-100', text: 'text-slate-600' };
}

function getRiskLabel(shop: ShopPin): { label: string; bg: string; text: string } {
  const s = shop.compliance_score ?? 0;
  if (s >= 70) return { label: 'low risk', bg: 'bg-green-100', text: 'text-green-700' };
  if (s >= 40) return { label: 'medium risk', bg: 'bg-amber-100', text: 'text-amber-700' };
  if (shop.compliance_score !== undefined) return { label: 'high risk', bg: 'bg-red-100', text: 'text-red-700' };
  return { label: 'unknown', bg: 'bg-slate-100', text: 'text-slate-500' };
}

function getTileUrl(style: MapStyle): string {
  if (style === 'light') return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  if (style === 'satellite') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
}

// ─── Dynamic Leaflet import (client-only) ─────────────────────────────────────

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const useMap = dynamic(() => import('react-leaflet').then(m => m.useMap), { ssr: false }) as unknown as typeof import('react-leaflet').useMap;

// ─── Tile layer switcher ──────────────────────────────────────────────────────

function TileLayerSwitcher({ style }: { style: MapStyle }) {
  // We use a key to force remount when style changes
  return (
    <TileLayer
      key={style}
      url={getTileUrl(style)}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    />
  );
}

// ─── Shop Popup ───────────────────────────────────────────────────────────────

function ShopPopupContent({ shop, onClose }: { shop: ShopPin; onClose: () => void }) {
  const router = useRouter();
  const status = getStatusLabel(shop);
  const risk = getRiskLabel(shop);
  const score = shop.compliance_score;

  return (
    <div className="bg-white rounded-xl shadow-xl p-4 min-w-[240px] relative">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 text-lg leading-none"
      >×</button>

      <div className="flex items-center gap-3 mb-3">
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
        {score !== undefined && (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
            {score}%
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

// ─── Legend Card ──────────────────────────────────────────────────────────────

function LegendCard({ view }: { view: MapView }) {
  return (
    <div className="absolute bottom-6 left-4 z-[400] bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-lg min-w-[160px]">
      <p className="text-white text-xs font-bold tracking-widest uppercase mb-3">Legend</p>
      {[
        { color: 'bg-emerald-500', label: 'Compliant' },
        { color: 'bg-amber-500', label: 'Partially Compliant' },
        { color: 'bg-red-500', label: 'Non Compliant' },
        { color: 'bg-slate-500', label: 'Pending' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2 mb-1.5 text-slate-300 text-sm">
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`} />
          {label}
        </div>
      ))}
      <div className="border-t border-slate-700 mt-2 pt-2">
        <p className="text-slate-400 text-xs">
          View: <span className="text-cyan-400 font-medium capitalize">{view}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Spatial Intelligence Panel ───────────────────────────────────────────────

interface PanelProps {
  shops: ShopPin[];
  agents: AgentRow[];
  open: boolean;
  onToggle: () => void;
}

function SpatialPanel({ shops, agents, open, onToggle }: PanelProps) {
  const avgScore = shops.length
    ? Math.round(shops.reduce((s, sh) => s + (sh.compliance_score ?? 0), 0) / shops.length)
    : 0;

  const compliantCount = shops.filter(s => s.compliance_tier === 1 || s.compliance_tier === 2).length;
  const partialCount = shops.filter(s => s.compliance_tier === 3).length;
  const nonCompliantCount = shops.filter(s => s.compliance_tier === 4).length;
  const pendingCount = shops.filter(s => !s.compliance_tier).length;
  const highRisk = shops.filter(s => (s.compliance_score ?? 0) < 40 && s.compliance_score !== undefined).length;

  const munis = ['KwaDukuza', 'Maphumulo', 'Mandeni', 'Ndwedwe'];
  const muniCounts = munis.map(m => ({
    name: m,
    count: shops.filter(s => s.municipality?.toLowerCase().includes(m.toLowerCase())).length,
  }));
  const maxMuni = Math.max(...muniCounts.map(m => m.count), 1);

  // Top 5 wards by density
  const wardMap: Record<string, number> = {};
  shops.forEach(s => { if (s.ward_no) wardMap[s.ward_no] = (wardMap[s.ward_no] || 0) + 1; });
  const topWards = Object.entries(wardMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const total = shops.length;
  const barWidth = (n: number) => total > 0 ? `${(n / total) * 100}%` : '0%';

  return (
    <div
      className={`absolute top-0 right-0 h-full z-[500] flex transition-all duration-300 ease-in-out`}
      style={{ width: open ? '300px' : '0' }}
    >
      {/* Toggle tab */}
      <button
        onClick={onToggle}
        className="absolute -left-6 top-1/2 -translate-y-1/2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-l-lg w-6 h-10 flex items-center justify-center z-10 transition-colors shadow-lg"
        aria-label={open ? 'Collapse panel' : 'Expand panel'}
      >
        {open ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Panel body */}
      <div className="w-full h-full bg-slate-900 border-l border-slate-800 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Focus className="w-5 h-5 text-white" />
            <div>
              <p className="text-white font-bold text-base leading-tight">Spatial Intelligence</p>
              <p className="text-cyan-100 text-xs">iLembe District GIS Dashboard</p>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="p-3 grid grid-cols-2 gap-2 flex-shrink-0">
          {[
            { icon: <Store className="w-4 h-4 text-cyan-400" />, value: shops.length, label: 'Mapped Shops', color: 'text-cyan-400' },
            { icon: <BarChart2 className="w-4 h-4 text-blue-400" />, value: `${avgScore}%`, label: 'Avg. Score', color: 'text-blue-400' },
            { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, value: compliantCount, label: 'Compliant', color: 'text-emerald-400' },
            { icon: <TriangleAlert className="w-4 h-4 text-red-400" />, value: highRisk, label: 'High Risk', color: 'text-red-400' },
          ].map(({ icon, value, label, color }) => (
            <div key={label} className="bg-slate-800 rounded-lg p-3">
              {icon}
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Compliance Distribution */}
        <div className="flex-shrink-0">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase px-4 pt-3 pb-2">Compliance Distribution</p>
          <div className="mx-4 h-2.5 rounded-full bg-slate-700 overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: barWidth(compliantCount) }} />
            <div className="bg-amber-500 h-full" style={{ width: barWidth(partialCount) }} />
            <div className="bg-red-500 h-full" style={{ width: barWidth(nonCompliantCount) }} />
            <div className="bg-slate-500 h-full" style={{ width: barWidth(pendingCount) }} />
          </div>
          <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {[
              { color: 'bg-emerald-500', label: `Compliant (${compliantCount})` },
              { color: 'bg-amber-500', label: `Partial (${partialCount})` },
              { color: 'bg-red-500', label: `Non Compliant (${nonCompliantCount})` },
              { color: 'bg-slate-500', label: `Pending (${pendingCount})` },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1 text-slate-300 text-xs">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* By Municipality */}
        <div className="flex-shrink-0">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase px-4 pt-3 pb-2">By Municipality</p>
          {muniCounts.map(({ name, count }) => (
            <div key={name} className="px-4 py-1.5 flex items-center justify-between">
              <span className="text-slate-300 text-sm w-28 truncate">{name}</span>
              <div className="flex-1 mx-2 h-1.5 rounded-full bg-slate-700">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(count / maxMuni) * 100}%` }} />
              </div>
              <span className="text-slate-300 text-sm text-right w-4">{count}</span>
            </div>
          ))}
        </div>

        {/* Top Wards by Density */}
        <div className="flex-shrink-0 pb-1">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase px-4 pt-3 pb-2">Top Wards by Density</p>
          {topWards.length === 0 ? (
            <p className="px-4 text-slate-500 text-xs">No ward data available</p>
          ) : topWards.map(([ward, count], i) => (
            <div key={ward} className="mx-3 mb-1.5 rounded-lg bg-slate-800 px-3 py-2 flex items-center justify-between">
              <span className="text-slate-500 text-xs w-6">#{i + 1}</span>
              <span className="text-slate-200 text-sm font-medium flex-1">Ward {ward}</span>
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md px-2 py-0.5 text-xs font-medium">{count}</span>
            </div>
          ))}
        </div>

        {/* Field Agents */}
        <div className="flex-shrink-0 pb-4">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase px-4 pt-3 pb-2">
            Field Agents ({agents.length})
          </p>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {agents.map((agent) => (
              <div key={agent.id} className="px-4 py-2 flex items-center justify-between border-b border-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{agent.full_name}</span>
                </div>
                <span className="text-slate-500 text-xs">{agent.municipality || '—'}</span>
              </div>
            ))}
            {agents.length === 0 && <p className="px-4 text-slate-500 text-xs">No agents found</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main GIS Page ────────────────────────────────────────────────────────────

export default function GISCommandCentre() {
  const router = useRouter();
  const [shops, setShops] = useState<ShopPin[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapView, setMapView] = useState<MapView>('pins');
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedShop, setSelectedShop] = useState<ShopPin | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [muniFilter, setMuniFilter] = useState('All Municipalities');
  const [riskFilter, setRiskFilter] = useState('All Risks');

  const supabase = createClient();

  useEffect(() => { setIsClient(true); }, []);

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const [shopsRes, agentsRes] = await Promise.all([
      supabase.from('assessments').select('id, shop_name, owner_name, municipality, ward_no, gps_lat, gps_lng, compliance_score, compliance_tier, status').not('gps_lat', 'is', null).not('gps_lng', 'is', null),
      supabase.from('users').select('id, full_name, municipality').eq('role_tier', 4).limit(200),
    ]);

    if (shopsRes.data) setShops(shopsRes.data as ShopPin[]);
    if (agentsRes.data) setAgents(agentsRes.data as AgentRow[]);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Apply filters
  const filteredShops = shops.filter(s => {
    if (statusFilter !== 'All Status') {
      const map: Record<string, number[]> = { Compliant: [1, 2], Partial: [3], Pending: [] };
      if (statusFilter === 'Compliant' && !(s.compliance_tier === 1 || s.compliance_tier === 2)) return false;
      if (statusFilter === 'Partial' && s.compliance_tier !== 3) return false;
      if (statusFilter === 'Pending' && s.compliance_tier) return false;
    }
    if (muniFilter !== 'All Municipalities' && !s.municipality?.toLowerCase().includes(muniFilter.toLowerCase())) return false;
    if (riskFilter !== 'All Risks') {
      const score = s.compliance_score ?? 0;
      if (riskFilter === 'Low Risk' && score < 70) return false;
      if (riskFilter === 'Medium Risk' && (score < 40 || score >= 70)) return false;
      if (riskFilter === 'High Risk' && score >= 40) return false;
    }
    return true;
  });

  if (loading || !isClient) {
    return (
      <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading GIS Command Centre...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden bg-slate-950">

      {/* ── Top Navbar ── */}
      <header className="flex items-center justify-between px-4 py-3 flex-shrink-0 z-[600] bg-slate-950 border-b border-slate-800" style={{ minHeight: '56px' }}>
        {/* Left */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <div>
            <p className="text-white text-base font-semibold leading-tight">GIS Command Centre</p>
            <p className="text-slate-400 text-xs leading-tight">
              {filteredShops.length}/{shops.length} shops · iLembe District
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* View toggles */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {([
              { id: 'pins' as MapView, icon: <MapPin className="w-4 h-4" />, label: 'Pins' },
              { id: 'heat' as MapView, icon: <Activity className="w-4 h-4" />, label: 'Heat' },
              { id: 'wards' as MapView, icon: <Circle className="w-4 h-4" />, label: 'Wards' },
            ] as { id: MapView; icon: React.ReactNode; label: string }[]).map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setMapView(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                  mapView === id
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Map style */}
          <select
            value={mapStyle}
            onChange={e => setMapStyle(e.target.value as MapStyle)}
            className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-1.5 text-sm"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="satellite">Satellite</option>
          </select>

          {/* Filters */}
          <button
            onClick={() => setFiltersOpen(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-all ${
              filtersOpen
                ? 'bg-cyan-600 border-cyan-600 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>
      </header>

      {/* ── Filter Bar ── */}
      {filtersOpen && (
        <div className="flex-shrink-0 z-[600] bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap gap-2">
          {[
            { value: statusFilter, setter: setStatusFilter, options: ['All Status', 'Compliant', 'Partial', 'Pending'] },
            { value: muniFilter, setter: setMuniFilter, options: ['All Municipalities', 'KwaDukuza', 'Maphumulo', 'Mandeni', 'Ndwedwe'] },
            { value: riskFilter, setter: setRiskFilter, options: ['All Risks', 'Low Risk', 'Medium Risk', 'High Risk'] },
          ].map(({ value, setter, options }) => (
            <select
              key={options[0]}
              value={value}
              onChange={e => setter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-1.5 text-sm min-w-[140px]"
            >
              {options.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>
      )}

      {/* ── Map + Overlays ── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Leaflet map */}
        <MapContainer
          center={[-29.5, 30.8]}
          zoom={10}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          <TileLayerSwitcher style={mapStyle} />

          {mapView === 'pins' && filteredShops.map(shop => {
            const color = getPinColor(shop);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const L = require('leaflet');
            const icon = L.divIcon({
              className: '',
              html: `<div style="
                width:28px;height:34px;position:relative;
              ">
                <svg viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">
                  <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 20 14 20s14-10.667 14-20C28 6.268 21.732 0 14 0z" fill="${color}"/>
                  <circle cx="14" cy="13" r="5" fill="white" opacity="0.9"/>
                </svg>
              </div>`,
              iconSize: [28, 34],
              iconAnchor: [14, 34],
              popupAnchor: [0, -36],
            });
            return (
              <Marker
                key={shop.id}
                position={[shop.gps_lat, shop.gps_lng]}
                icon={icon}
                eventHandlers={{ click: () => setSelectedShop(shop) }}
              />
            );
          })}

          {mapView === 'heat' && filteredShops.map(shop => {
            const color = getPinColor(shop);
            return (
              <CircleMarker
                key={shop.id}
                center={[shop.gps_lat, shop.gps_lng]}
                radius={22}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.35,
                  weight: 2,
                  opacity: 0.6,
                }}
                eventHandlers={{ click: () => setSelectedShop(shop) }}
              />
            );
          })}

          {mapView === 'wards' && filteredShops.map(shop => (
            <CircleMarker
              key={shop.id}
              center={[shop.gps_lat, shop.gps_lng]}
              radius={14}
              pathOptions={{
                color: '#22d3ee',
                fillColor: '#22d3ee',
                fillOpacity: 0.2,
                weight: 3,
              }}
              eventHandlers={{ click: () => setSelectedShop(shop) }}
            />
          ))}
        </MapContainer>

        {/* Shop popup */}
        {selectedShop && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[450] pointer-events-auto">
            <ShopPopupContent shop={selectedShop} onClose={() => setSelectedShop(null)} />
          </div>
        )}

        {/* Legend */}
        <LegendCard view={mapView} />

        {/* Spatial Intelligence Panel */}
        <SpatialPanel
          shops={filteredShops}
          agents={agents}
          open={panelOpen}
          onToggle={() => setPanelOpen(o => !o)}
        />
      </div>
    </div>
  );
}
