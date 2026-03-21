'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase';
import {
  MapPin, Activity, Circle, Filter,
  ChevronLeft, ChevronRight, ArrowLeft, TriangleAlert,
  CheckCircle2, BarChart2, Focus, Store,
} from 'lucide-react';
import type { ShopPin, MapView, MapStyle } from '@/components/MapCanvas';

// ─── Dynamically import the map (Leaflet is client-only) ─────────────────────

const MapCanvas = dynamic(() => import('@/components/MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentRow {
  id: string;
  full_name: string;
  municipality?: string;
}

// ─── Legend Card ──────────────────────────────────────────────────────────────

function LegendCard({ view }: { view: MapView }) {
  return (
    <div className="absolute bottom-6 left-4 z-[400] bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-lg min-w-[170px] pointer-events-auto">
      <p className="text-white text-xs font-bold tracking-widest uppercase mb-3">Legend</p>
      {[
        { color: 'bg-emerald-500', label: 'Compliant' },
        { color: 'bg-amber-500',   label: 'Partially Compliant' },
        { color: 'bg-red-500',     label: 'Non Compliant' },
        { color: 'bg-slate-500',   label: 'Pending' },
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

function SpatialPanel({
  shops, agents, open, onToggle,
}: {
  shops: ShopPin[];
  agents: AgentRow[];
  open: boolean;
  onToggle: () => void;
}) {
  const total = shops.length;
  const avgScore = total
    ? Math.round(shops.reduce((s, sh) => s + (sh.compliance_score ?? 0), 0) / total)
    : 0;
  const compliant    = shops.filter(s => s.compliance_tier === 1 || s.compliance_tier === 2).length;
  const partial      = shops.filter(s => s.compliance_tier === 3).length;
  const nonCompliant = shops.filter(s => s.compliance_tier === 4).length;
  const pending      = shops.filter(s => !s.compliance_tier).length;
  const highRisk     = shops.filter(s => s.compliance_score !== undefined && s.compliance_score < 40).length;

  const munis = ['KwaDukuza', 'Maphumulo', 'Mandeni', 'Ndwedwe'];
  const muniCounts = munis.map(m => ({
    name: m,
    count: shops.filter(s => s.municipality?.toLowerCase().includes(m.toLowerCase())).length,
  }));
  const maxMuni = Math.max(...muniCounts.map(m => m.count), 1);

  const wardMap: Record<string, number> = {};
  shops.forEach(s => { if (s.ward_no) wardMap[s.ward_no] = (wardMap[s.ward_no] || 0) + 1; });
  const topWards = Object.entries(wardMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const barW = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';

  return (
    <div className={`absolute top-0 right-0 h-full z-[450] flex transition-all duration-300 ease-in-out ${open ? 'w-[300px]' : 'w-0'}`}>
      {/* Toggle tab */}
      <button
        onClick={onToggle}
        className="absolute -left-6 top-1/2 -translate-y-1/2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-l-lg w-6 h-10 flex items-center justify-center z-10 transition-colors shadow-lg"
      >
        {open ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

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

        {/* Stats 2×2 */}
        <div className="p-3 grid grid-cols-2 gap-2 flex-shrink-0">
          {[
            { icon: <Store className="w-4 h-4 text-cyan-400" />,        val: total,      label: 'Mapped Shops', color: 'text-cyan-400' },
            { icon: <BarChart2 className="w-4 h-4 text-blue-400" />,    val: `${avgScore}%`, label: 'Avg. Score',   color: 'text-blue-400' },
            { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, val: compliant, label: 'Compliant',    color: 'text-emerald-400' },
            { icon: <TriangleAlert className="w-4 h-4 text-red-400" />, val: highRisk,   label: 'High Risk',    color: 'text-red-400' },
          ].map(({ icon, val, label, color }) => (
            <div key={label} className="bg-slate-800 rounded-lg p-3">
              {icon}
              <p className={`text-2xl font-bold mt-1 ${color}`}>{val}</p>
              <p className="text-slate-400 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Compliance distribution */}
        <div className="flex-shrink-0">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase px-4 pt-1 pb-2">
            Compliance Distribution
          </p>
          <div className="mx-4 h-2.5 rounded-full bg-slate-700 overflow-hidden flex">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: barW(compliant) }} />
            <div className="bg-amber-500 h-full transition-all"   style={{ width: barW(partial) }} />
            <div className="bg-red-500 h-full transition-all"     style={{ width: barW(nonCompliant) }} />
            <div className="bg-slate-500 h-full transition-all"   style={{ width: barW(pending) }} />
          </div>
          <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {[
              { c: 'bg-emerald-500', l: `Compliant (${compliant})` },
              { c: 'bg-amber-500',   l: `Partial (${partial})` },
              { c: 'bg-red-500',     l: `Non-Compliant (${nonCompliant})` },
              { c: 'bg-slate-500',   l: `Pending (${pending})` },
            ].map(({ c, l }) => (
              <div key={l} className="flex items-center gap-1 text-slate-300 text-xs">
                <span className={`w-2 h-2 rounded-full ${c}`} /> {l}
              </div>
            ))}
          </div>
        </div>

        {/* By Municipality */}
        <div className="flex-shrink-0">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase px-4 pt-2 pb-2">
            By Municipality
          </p>
          {muniCounts.map(({ name, count }) => (
            <div key={name} className="px-4 py-1.5 flex items-center gap-2">
              <span className="text-slate-300 text-sm w-24 truncate">{name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-700">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(count / maxMuni) * 100}%` }} />
              </div>
              <span className="text-slate-300 text-sm w-4 text-right">{count}</span>
            </div>
          ))}
        </div>

        {/* Top Wards */}
        <div className="flex-shrink-0 pb-1">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase px-4 pt-3 pb-2">
            Top Wards by Density
          </p>
          {topWards.length === 0
            ? <p className="px-4 text-slate-500 text-xs">No ward data</p>
            : topWards.map(([ward, count], i) => (
              <div key={ward} className="mx-3 mb-1.5 rounded-lg bg-slate-800 px-3 py-2 flex items-center gap-2">
                <span className="text-slate-500 text-xs w-5">#{i + 1}</span>
                <span className="text-slate-200 text-sm font-medium flex-1">Ward {ward}</span>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md px-2 py-0.5 text-xs font-medium">
                  {count}
                </span>
              </div>
            ))
          }
        </div>

        {/* Field Agents */}
        <div className="flex-shrink-0 pb-4">
          <p className="text-slate-400 text-xs font-bold tracking-widest uppercase px-4 pt-3 pb-2">
            Field Agents ({agents.length})
          </p>
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {agents.map(a => (
              <div key={a.id} className="px-4 py-2 flex items-center justify-between border-b border-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{a.full_name}</span>
                </div>
                <span className="text-slate-500 text-xs">{a.municipality || '—'}</span>
              </div>
            ))}
            {agents.length === 0 && <p className="px-4 text-slate-500 text-xs">No agents</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GISCommandCentre() {
  const router = useRouter();
  const supabase = createClient();

  const [shops, setShops]               = useState<ShopPin[]>([]);
  const [agents, setAgents]             = useState<AgentRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [mapView, setMapView]           = useState<MapView>('pins');
  const [mapStyle, setMapStyle]         = useState<MapStyle>('dark');
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const [panelOpen, setPanelOpen]       = useState(true);
  const [selectedShop, setSelectedShop] = useState<ShopPin | null>(null);

  const [statusFilter, setStatusFilter] = useState('All Status');
  const [muniFilter,   setMuniFilter]   = useState('All Municipalities');
  const [riskFilter,   setRiskFilter]   = useState('All Risks');

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const [shopsRes, agentsRes] = await Promise.all([
      supabase.from('assessments')
        .select('id, shop_name, owner_name, municipality, ward_no, gps_lat, gps_lng, compliance_score, compliance_tier, status')
        .not('gps_lat', 'is', null)
        .not('gps_lng', 'is', null),
      supabase.from('users')
        .select('id, full_name, municipality')
        .limit(200),
    ]);

    if (shopsRes.data) setShops(shopsRes.data as ShopPin[]);
    if (agentsRes.data) setAgents(agentsRes.data as AgentRow[]);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredShops = shops.filter(s => {
    if (statusFilter === 'Compliant' && !(s.compliance_tier === 1 || s.compliance_tier === 2)) return false;
    if (statusFilter === 'Partial'   && s.compliance_tier !== 3) return false;
    if (statusFilter === 'Pending'   && s.compliance_tier) return false;
    if (muniFilter !== 'All Municipalities' && !s.municipality?.toLowerCase().includes(muniFilter.toLowerCase())) return false;
    const sc = s.compliance_score ?? 0;
    if (riskFilter === 'Low Risk'    && sc < 70) return false;
    if (riskFilter === 'Medium Risk' && (sc < 40 || sc >= 70)) return false;
    if (riskFilter === 'High Risk'   && sc >= 40) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading GIS Command Centre...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden bg-slate-950">

      {/* ── Navbar ── */}
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-slate-950 border-b border-slate-800"
        style={{ zIndex: 600, minHeight: 56 }}
      >
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

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {([
              { id: 'pins'  as MapView, icon: <MapPin className="w-4 h-4" />,    label: 'Pins' },
              { id: 'heat'  as MapView, icon: <Activity className="w-4 h-4" />,  label: 'Heat' },
              { id: 'wards' as MapView, icon: <Circle className="w-4 h-4" />,    label: 'Wards' },
            ]).map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setMapView(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                  mapView === id ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <select
            value={mapStyle}
            onChange={e => setMapStyle(e.target.value as MapStyle)}
            className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-1.5 text-sm"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="satellite">Satellite</option>
          </select>

          <button
            onClick={() => setFiltersOpen(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-all ${
              filtersOpen
                ? 'bg-cyan-600 border-cyan-600 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>
      </header>

      {/* ── Filter Bar ── */}
      {filtersOpen && (
        <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap gap-2" style={{ zIndex: 600 }}>
          {[
            { val: statusFilter, set: setStatusFilter, opts: ['All Status', 'Compliant', 'Partial', 'Pending'] },
            { val: muniFilter,   set: setMuniFilter,   opts: ['All Municipalities', 'KwaDukuza', 'Maphumulo', 'Mandeni', 'Ndwedwe'] },
            { val: riskFilter,   set: setRiskFilter,   opts: ['All Risks', 'Low Risk', 'Medium Risk', 'High Risk'] },
          ].map(({ val, set, opts }) => (
            <select
              key={opts[0]}
              value={val}
              onChange={e => set(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-1.5 text-sm min-w-[140px]"
            >
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>
      )}

      {/* ── Map area ── */}
      <div className="flex-1 relative overflow-hidden">
        <MapCanvas
          shops={filteredShops}
          mapView={mapView}
          mapStyle={mapStyle}
          selectedShop={selectedShop}
          onShopClick={setSelectedShop}
          onClosePopup={() => setSelectedShop(null)}
        />

        {/* Legend (outside MapCanvas so it doesn't get z-index issues) */}
        <LegendCard view={mapView} />

        {/* Spatial Intelligence panel */}
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
