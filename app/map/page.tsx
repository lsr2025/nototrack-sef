'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapAssessment {
  id: string;
  shop_name: string;
  owner_name: string | null;
  gps_lat: number;
  gps_lng: number;
  compliance_score: number | null;
  compliance_tier: number | null;
  status: string;
  address: string | null;
}

type ViewMode = 'pins' | 'wards' | 'heat';
type MapType = 'satellite' | 'street';

interface WardGroup {
  ward: string;
  municipality: string;
  count: number;
  avgScore: number;
  compliant: number;
  highRisk: number;
  lat: number;
  lng: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPinColor(tier: number | null, status: string): string {
  if (!tier) {
    if (status === 'draft' || status === 'pending_sync') return '#6B7280'; // gray
    return '#6B7280';
  }
  if (tier === 1 || tier === 2) return '#10B981'; // green
  if (tier === 3) return '#F97316';               // orange
  if (tier === 4) return '#EF4444';               // red
  return '#6B7280';
}

function getComplianceBadge(tier: number | null): { label: string; bg: string; color: string } {
  if (tier === 1 || tier === 2) return { label: 'compliant', bg: '#D1FAE5', color: '#065F46' };
  if (tier === 3) return { label: 'partial', bg: '#FFEDD5', color: '#9A3412' };
  if (tier === 4) return { label: 'non-compliant', bg: '#FEE2E2', color: '#991B1B' };
  return { label: 'pending', bg: '#F3F4F6', color: '#374151' };
}

function getRiskBadge(score: number | null): { label: string; bg: string; color: string } {
  if (score === null) return { label: 'unknown', bg: '#F3F4F6', color: '#374151' };
  if (score >= 70) return { label: 'low risk', bg: '#D1FAE5', color: '#065F46' };
  if (score >= 40) return { label: 'medium risk', bg: '#FFEDD5', color: '#9A3412' };
  return { label: 'high risk', bg: '#FEE2E2', color: '#991B1B' };
}

// Approximate ward centroids within iLembe District
const WARD_CENTROIDS: Record<string, { lat: number; lng: number; municipality: string }> = {
  'Ward 1':  { lat: -29.27, lng: 31.13, municipality: 'KwaDukuza' },
  'Ward 2':  { lat: -29.31, lng: 31.18, municipality: 'KwaDukuza' },
  'Ward 3':  { lat: -29.35, lng: 31.22, municipality: 'KwaDukuza' },
  'Ward 4':  { lat: -29.39, lng: 31.09, municipality: 'Maphumulo' },
  'Ward 5':  { lat: -29.22, lng: 31.06, municipality: 'Maphumulo' },
  'Ward 6':  { lat: -29.44, lng: 31.26, municipality: 'Mandeni' },
  'Ward 7':  { lat: -29.15, lng: 31.30, municipality: 'Mandeni' },
  'Ward 8':  { lat: -29.50, lng: 31.15, municipality: 'Ndwedwe' },
  'Ward 9':  { lat: -29.46, lng: 31.03, municipality: 'Ndwedwe' },
  'Ward 10': { lat: -29.20, lng: 31.24, municipality: 'KwaDukuza' },
};

const MUNICIPALITIES = ['KwaDukuza', 'Maphumulo', 'Mandeni', 'Ndwedwe'];

// ─── Spatial Intelligence Panel ───────────────────────────────────────────────

interface SpatialPanelProps {
  assessments: MapAssessment[];
  wardGroups: WardGroup[];
  onClose: () => void;
}

function SpatialPanel({ assessments, wardGroups, onClose }: SpatialPanelProps) {
  const total = assessments.length;
  const withScore = assessments.filter((a) => a.compliance_score !== null);
  const avgScore = withScore.length
    ? Math.round(withScore.reduce((s, a) => s + (a.compliance_score ?? 0), 0) / withScore.length)
    : 0;
  const compliantCount = assessments.filter((a) => a.compliance_tier === 1 || a.compliance_tier === 2).length;
  const highRiskCount = assessments.filter((a) => a.compliance_score !== null && (a.compliance_score as number) < 40).length;

  const tier1 = assessments.filter((a) => a.compliance_tier === 1 || a.compliance_tier === 2).length;
  const tier3 = assessments.filter((a) => a.compliance_tier === 3).length;
  const tier4 = assessments.filter((a) => a.compliance_tier === 4).length;
  const pending = assessments.filter((a) => !a.compliance_tier).length;

  const byMunicipality = MUNICIPALITIES.map((m) => {
    const mAssessments = assessments.filter((a) => {
      // naive match: check address contains municipality name
      return a.address?.toLowerCase().includes(m.toLowerCase());
    });
    return { name: m, count: mAssessments.length };
  });
  // Sort wards by density
  const sortedWards = [...wardGroups].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div
      className="absolute top-0 right-0 h-full overflow-y-auto z-20 flex flex-col"
      style={{ width: '320px', background: '#0D1B35', borderLeft: '1px solid #1E3A5F' }}
    >
      {/* Header */}
      <div
        style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)' }}
        className="p-4 flex-shrink-0"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-bold text-sm">Spatial Intelligence</span>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-lg leading-none"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>
        <p className="text-blue-100 text-xs">iLembe District GIS Dashboard</p>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Mapped Shops', value: total, icon: '🏪' },
            { label: 'Avg Score', value: `${avgScore}%`, icon: '📊' },
            { label: 'Compliant', value: compliantCount, icon: '✅' },
            { label: 'High Risk', value: highRiskCount, icon: '⚠️' },
          ].map((stat) => (
            <div key={stat.label} style={{ background: '#1E3A5F' }} className="rounded-xl p-3">
              <div className="text-lg mb-1">{stat.icon}</div>
              <div className="text-white font-bold text-xl">{stat.value}</div>
              <div className="text-blue-300 text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Compliance Distribution */}
        <div>
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2">
            Compliance Distribution
          </p>
          <div className="rounded-xl overflow-hidden h-4 flex" style={{ background: '#1E3A5F' }}>
            {total > 0 && (
              <>
                <div style={{ width: `${(tier1 / total) * 100}%`, background: '#10B981' }} />
                <div style={{ width: `${(tier3 / total) * 100}%`, background: '#F97316' }} />
                <div style={{ width: `${(tier4 / total) * 100}%`, background: '#EF4444' }} />
                <div style={{ width: `${(pending / total) * 100}%`, background: '#6B7280' }} />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {[
              { label: 'Compliant', color: '#10B981', count: tier1 },
              { label: 'Partial', color: '#F97316', count: tier3 },
              { label: 'Non-compliant', color: '#EF4444', count: tier4 },
              { label: 'Pending', color: '#6B7280', count: pending },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                <span className="text-blue-200 text-xs">{item.label} ({item.count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Municipality */}
        <div>
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
            By Municipality
          </p>
          <div className="space-y-2">
            {byMunicipality.map((m) => {
              const pct = total > 0 ? (m.count / total) * 100 : 0;
              return (
                <div key={m.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-blue-100 text-xs">{m.name}</span>
                    <span className="text-white text-xs font-semibold">{m.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1E3A5F' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: '#0EA5E9' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Wards by Density */}
        <div>
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
            Top Wards by Density
          </p>
          <div className="space-y-2">
            {sortedWards.length === 0 && (
              <p className="text-blue-300 text-xs">No ward data available</p>
            )}
            {sortedWards.map((ward, idx) => (
              <div
                key={ward.ward}
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ background: '#1E3A5F' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
                    style={{ background: '#0EA5E9', color: '#fff' }}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-white text-xs font-semibold">{ward.ward}</p>
                    <p className="text-blue-300 text-xs">{ward.municipality}</p>
                  </div>
                </div>
                <span
                  className="text-xs font-semibold rounded-full px-2 py-0.5"
                  style={{ background: '#0EA5E9', color: '#fff' }}
                >
                  {ward.count} shop{ward.count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Legend Card ──────────────────────────────────────────────────────────────

interface LegendProps {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
}

function LegendCard({ viewMode, onViewChange }: LegendProps) {
  return (
    <div
      className="absolute bottom-6 left-4 z-10 rounded-2xl p-4 shadow-2xl"
      style={{ background: 'rgba(13,27,53,0.93)', border: '1px solid #1E3A5F', minWidth: '200px' }}
    >
      <p className="text-white text-xs font-bold uppercase tracking-wider mb-3">Legend</p>
      <div className="space-y-1.5 mb-4">
        {[
          { color: '#10B981', label: 'Compliant' },
          { color: '#F97316', label: 'Partially Compliant' },
          { color: '#EF4444', label: 'Non Compliant' },
          { color: '#6B7280', label: 'Pending' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="text-blue-200 text-xs">{item.label}</span>
          </div>
        ))}
      </div>
      <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2">View</p>
      <div className="flex gap-1">
        {(['pins', 'wards', 'heat'] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className="flex-1 text-xs py-1 rounded-lg font-semibold capitalize transition-colors"
            style={{
              background: viewMode === v ? '#0EA5E9' : '#1E3A5F',
              color: viewMode === v ? '#fff' : '#93C5FD',
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const router = useRouter();
  const supabase = createClient();

  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null);
  const leafletLoadedRef = useRef(false);

  const [assessments, setAssessments] = useState<MapAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('pins');
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [showSpatialPanel, setShowSpatialPanel] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterTier, setFilterTier] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tileLayerRef, setTileLayerRef] = useState<any>(null);
  const [wardGroups, setWardGroups] = useState<WardGroup[]>([]);
  const [totalShops, setTotalShops] = useState(0);

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }

      const { data: aData } = await supabase
        .from('assessments')
        .select('id, shop_name, owner_name, gps_lat, gps_lng, compliance_score, compliance_tier, status, address')
        .not('gps_lat', 'is', null);

      if (aData) setAssessments(aData as MapAssessment[]);

      const { count } = await supabase
        .from('assessments')
        .select('id', { count: 'exact', head: true });
      setTotalShops(count ?? 0);

      setLoading(false);
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load Leaflet ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined' || leafletLoadedRef.current) return;
    leafletLoadedRef.current = true;

    // Inject Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    // Inject Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV/XN/WPeE=';
    script.crossOrigin = '';
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // ── Initialise map ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [-29.3, 31.2],
      zoom: 10,
      zoomControl: false,
    });

    // Add zoom control top-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Satellite tile layer (Esri)
    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
    );
    satLayer.addTo(map);
    setTileLayerRef(satLayer);

    // Markers layer group
    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;

    leafletMapRef.current = map;
  }, [mapReady]);

  // ── Switch tile layer on mapType change ────────────────────────────────────

  useEffect(() => {
    if (!leafletMapRef.current || !mapReady) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    if (tileLayerRef) {
      leafletMapRef.current.removeLayer(tileLayerRef);
    }

    const newLayer = mapType === 'satellite'
      ? L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
        )
      : L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }
        );

    newLayer.addTo(leafletMapRef.current);
    setTileLayerRef(newLayer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapType, mapReady]);

  // ── Render markers ─────────────────────────────────────────────────────────

  const renderMarkers = useCallback(() => {
    if (!leafletMapRef.current || !markersLayerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    markersLayerRef.current.clearLayers();

    const filtered = filterTier
      ? assessments.filter((a) => a.compliance_tier === filterTier)
      : assessments;

    if (viewMode === 'pins' || viewMode === 'heat') {
      filtered.forEach((a) => {
        const color = getPinColor(a.compliance_tier, a.status);
        const opacity = viewMode === 'heat' ? 0.6 : 1;
        const size = viewMode === 'heat' ? 20 : 14;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:${size}px;
            height:${size}px;
            border-radius:50%;
            background:${color};
            border:2px solid rgba(255,255,255,0.85);
            box-shadow:0 2px 6px rgba(0,0,0,0.4);
            opacity:${opacity};
            cursor:pointer;
          "></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const compliance = getComplianceBadge(a.compliance_tier);
        const risk = getRiskBadge(a.compliance_score);
        const wardLabel = a.address ? a.address.replace(/,.*$/, '') : 'iLembe';

        const popup = L.popup({
          maxWidth: 280,
          className: 'noto-popup',
        }).setContent(`
          <div style="
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            padding:12px;
            min-width:240px;
            border-radius:12px;
          ">
            <p style="font-weight:700;font-size:15px;color:#111827;margin:0 0 4px">${a.shop_name}</p>
            <p style="font-size:12px;color:#6B7280;margin:0 0 2px">${a.owner_name ?? 'Unknown Owner'}</p>
            <p style="font-size:12px;color:#6B7280;margin:0 0 12px">iLembe District &bull; ${wardLabel}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
              <span style="
                background:${compliance.bg};
                color:${compliance.color};
                font-size:11px;font-weight:600;
                padding:3px 8px;border-radius:999px;
              ">${compliance.label}</span>
              ${a.compliance_score !== null ? `<span style="
                background:#DBEAFE;
                color:#1E40AF;
                font-size:11px;font-weight:600;
                padding:3px 8px;border-radius:999px;
              ">${a.compliance_score}%</span>` : ''}
              <span style="
                background:${risk.bg};
                color:${risk.color};
                font-size:11px;font-weight:600;
                padding:3px 8px;border-radius:999px;
              ">${risk.label}</span>
            </div>
            <a
              href="/submissions"
              style="
                display:block;
                background:#111827;
                color:#fff;
                text-align:center;
                padding:8px 0;
                border-radius:8px;
                font-size:12px;
                font-weight:600;
                text-decoration:none;
              "
            >View Full Profile &rarr;</a>
          </div>
        `);

        L.marker([a.gps_lat, a.gps_lng], { icon })
          .bindPopup(popup)
          .addTo(markersLayerRef.current);
      });
    } else if (viewMode === 'wards') {
      // Group assessments by approximate ward
      const wardMap: Record<string, { assessments: MapAssessment[]; centroid: { lat: number; lng: number; municipality: string } }> = {};
      Object.entries(WARD_CENTROIDS).forEach(([ward, c]) => {
        wardMap[ward] = { assessments: [], centroid: c };
      });

      // Assign each assessment to nearest ward centroid
      filtered.forEach((a) => {
        let nearest = 'Ward 1';
        let minDist = Infinity;
        Object.entries(WARD_CENTROIDS).forEach(([ward, c]) => {
          const dist = Math.hypot(a.gps_lat - c.lat, a.gps_lng - c.lng);
          if (dist < minDist) { minDist = dist; nearest = ward; }
        });
        wardMap[nearest].assessments.push(a);
      });

      const groups: WardGroup[] = [];
      Object.entries(wardMap).forEach(([ward, info]) => {
        if (info.assessments.length === 0) return;
        const withScore = info.assessments.filter((a) => a.compliance_score !== null);
        const avgScore = withScore.length
          ? Math.round(withScore.reduce((s, a) => s + (a.compliance_score ?? 0), 0) / withScore.length)
          : 0;
        groups.push({
          ward,
          municipality: info.centroid.municipality,
          count: info.assessments.length,
          avgScore,
          compliant: info.assessments.filter((a) => a.compliance_tier === 1 || a.compliance_tier === 2).length,
          highRisk: info.assessments.filter((a) => a.compliance_score !== null && (a.compliance_score as number) < 40).length,
          lat: info.centroid.lat,
          lng: info.centroid.lng,
        });
      });
      setWardGroups(groups);

      groups.forEach((group) => {
        const radius = Math.max(20, group.count * 12);
        const color = group.count > 3 ? '#EF4444' : group.count > 1 ? '#F97316' : '#10B981';

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:${radius}px;
            height:${radius}px;
            border-radius:50%;
            background:${color};
            border:3px solid rgba(255,255,255,0.85);
            box-shadow:0 4px 12px rgba(0,0,0,0.35);
            display:flex;
            align-items:center;
            justify-content:center;
            color:#fff;
            font-weight:700;
            font-size:${radius > 30 ? 12 : 10}px;
            font-family:-apple-system,sans-serif;
            cursor:pointer;
          ">${group.count}</div>`,
          iconSize: [radius, radius],
          iconAnchor: [radius / 2, radius / 2],
        });

        const popup = L.popup({ maxWidth: 260 }).setContent(`
          <div style="font-family:-apple-system,sans-serif;padding:10px;">
            <p style="font-weight:700;font-size:14px;color:#111827;margin:0 0 4px">${group.ward}</p>
            <p style="font-size:12px;color:#6B7280;margin:0 0 10px">${group.municipality} Municipality</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
              <div style="background:#F9FAFB;padding:8px;border-radius:8px;text-align:center;">
                <p style="font-weight:700;font-size:16px;color:#111827;margin:0">${group.count}</p>
                <p style="font-size:11px;color:#9CA3AF;margin:0">Shops</p>
              </div>
              <div style="background:#F9FAFB;padding:8px;border-radius:8px;text-align:center;">
                <p style="font-weight:700;font-size:16px;color:#111827;margin:0">${group.avgScore}%</p>
                <p style="font-size:11px;color:#9CA3AF;margin:0">Avg Score</p>
              </div>
            </div>
            <p style="font-size:12px;color:#10B981;margin:0">${group.compliant} compliant &bull; ${group.highRisk} high risk</p>
          </div>
        `);

        L.marker([group.lat, group.lng], { icon })
          .bindPopup(popup)
          .addTo(markersLayerRef.current);
      });
    }
  }, [assessments, viewMode, filterTier]);

  useEffect(() => {
    if (mapReady && leafletMapRef.current) {
      renderMarkers();
    }
  }, [mapReady, renderMarkers]);

  // ── Ward panel sync ────────────────────────────────────────────────────────

  useEffect(() => {
    if (viewMode === 'wards') {
      setShowSpatialPanel(true);
    } else {
      setShowSpatialPanel(false);
    }
  }, [viewMode]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const noGPS = !loading && assessments.length === 0;

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden" style={{ background: '#0D1B35' }}>
      {/* ── Dark Header ──────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 z-20"
        style={{ background: '#0D1B35', borderBottom: '1px solid #1E3A5F', minHeight: '56px' }}
      >
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 36, height: 36, background: '#1E3A5F', color: '#93C5FD' }}
            aria-label="Back to dashboard"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">GIS Command Centre</h1>
            <p className="text-blue-300 text-xs">
              {assessments.length}/{totalShops} shops &bull; iLembe District
            </p>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* View toggles */}
          {(['pins', 'heat', 'wards'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-colors"
              style={{
                background: viewMode === v ? '#0EA5E9' : '#1E3A5F',
                color: viewMode === v ? '#fff' : '#93C5FD',
              }}
            >
              {v === 'pins' ? 'Pins' : v === 'heat' ? 'Heat' : 'Wards'}
            </button>
          ))}

          {/* Map type dropdown */}
          <select
            value={mapType}
            onChange={(e) => setMapType(e.target.value as MapType)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg outline-none"
            style={{ background: '#1E3A5F', color: '#93C5FD', border: 'none', cursor: 'pointer' }}
          >
            <option value="satellite">Satellite ▾</option>
            <option value="street">Street ▾</option>
          </select>

          {/* Filters */}
          <div className="relative">
            <button
              onClick={() => setShowFilters((f) => !f)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: filterTier ? '#0EA5E9' : '#1E3A5F',
                color: filterTier ? '#fff' : '#93C5FD',
              }}
            >
              Filters{filterTier ? ` · T${filterTier}` : ''}
            </button>
            {showFilters && (
              <div
                className="absolute top-full right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-30"
                style={{ background: '#1E3A5F', border: '1px solid #2563EB', minWidth: '160px' }}
              >
                <p className="text-blue-300 text-xs font-bold px-3 pt-3 pb-1 uppercase tracking-wider">
                  Filter by Tier
                </p>
                {[
                  { label: 'All', value: null },
                  { label: 'Tier 1 — Gold', value: 1 },
                  { label: 'Tier 2 — Good', value: 2 },
                  { label: 'Tier 3 — Partial', value: 3 },
                  { label: 'Tier 4 — Risk', value: 4 },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => { setFilterTier(opt.value); setShowFilters(false); }}
                    className="block w-full text-left text-xs px-3 py-2 transition-colors"
                    style={{
                      color: filterTier === opt.value ? '#fff' : '#93C5FD',
                      background: filterTier === opt.value ? '#0EA5E9' : 'transparent',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Map Area ─────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Leaflet map container */}
        <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 0 }} />

        {/* Loading overlay */}
        {(loading || !mapReady) && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
            style={{ background: 'rgba(13,27,53,0.85)' }}
          >
            <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-blue-200 text-sm font-medium">
              {!mapReady ? 'Loading map...' : 'Fetching shop locations...'}
            </p>
          </div>
        )}

        {/* No GPS fallback */}
        {noGPS && mapReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div
              className="rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4"
              style={{ background: 'rgba(13,27,53,0.95)', border: '1px solid #1E3A5F' }}
            >
              <div className="text-4xl mb-4">📍</div>
              <p className="text-white font-bold text-base mb-2">No GPS Data Found</p>
              <p className="text-blue-300 text-sm leading-relaxed">
                No shops with GPS coordinates found. GPS is captured during assessments.
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        {mapReady && !loading && (
          <LegendCard viewMode={viewMode} onViewChange={setViewMode} />
        )}

        {/* Spatial Intelligence Panel */}
        {showSpatialPanel && mapReady && (
          <SpatialPanel
            assessments={assessments}
            wardGroups={wardGroups}
            onClose={() => { setShowSpatialPanel(false); setViewMode('pins'); }}
          />
        )}

        {/* Click outside to close filters */}
        {showFilters && (
          <div
            className="absolute inset-0 z-10"
            onClick={() => setShowFilters(false)}
          />
        )}
      </div>

      {/* ── Leaflet popup overrides ────────────────────────────────────────── */}
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 14px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.22) !important;
          padding: 0 !important;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip-container {
          display: none !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .leaflet-control-zoom a {
          background: #1E3A5F !important;
          color: #93C5FD !important;
          border: 1px solid #2563EB !important;
        }
        .leaflet-control-zoom a:hover {
          background: #0EA5E9 !important;
          color: #fff !important;
        }
        .leaflet-control-attribution {
          background: rgba(13,27,53,0.7) !important;
          color: #6B7280 !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a {
          color: #93C5FD !important;
        }
      `}</style>
    </div>
  );
}
