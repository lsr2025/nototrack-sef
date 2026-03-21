'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import { User } from '@/lib/types';
import {
  ArrowLeft,
  Pencil,
  Clock,
  TriangleAlert,
  ClipboardCheck,
  Navigation,
  User as UserIcon,
  FileText,
  MapPin,
  Phone,
  Building2,
  Users,
  Calendar,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  ShoppingBag,
} from 'lucide-react';

// ─── Extended Assessment type with all wizard fields ──────────────────────────

interface ShopDetail {
  id: string;
  offline_id?: string;
  agent_id?: string;
  // Step 1
  shop_name: string;
  owner_name?: string;
  email?: string;
  contact?: string;
  address?: string;
  municipality?: string;
  ward_no?: string;
  gps_lat?: number;
  gps_lng?: number;
  // Step 2
  is_registered?: boolean;
  cipc_number?: string;
  has_bank_account?: boolean;
  has_coa?: boolean;
  coa_number?: string;
  // Step 3
  years_operating?: string;
  structure_type?: string;
  store_size?: string;
  storage?: string[];
  products?: string[];
  // Step 7
  monthly_turnover?: string;
  num_employees?: string;
  payment_methods?: string[];
  // Step 8
  sa_citizen?: boolean;
  tax_compliant?: boolean;
  // Step 9
  photo_front_url?: string;
  photo_interior_url?: string;
  photo_owner_url?: string;
  // Compliance
  compliance_score?: number;
  compliance_tier?: number;
  status: string;
  submitted_at?: string;
  created_at?: string;
  // DB extras
  fieldworker_name?: string;
  permit_number?: string;
  permit_expiry?: string;
  inspection_count?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'synced':
      return { label: 'Compliant', bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> };
    case 'submitted':
      return { label: 'Pending Review', bg: 'bg-slate-500/20 border-slate-500/30', text: 'text-slate-300', icon: <Clock className="w-3 h-3" /> };
    case 'pending_sync':
      return { label: 'Pending Review', bg: 'bg-slate-500/20 border-slate-500/30', text: 'text-slate-300', icon: <Clock className="w-3 h-3" /> };
    case 'draft':
      return { label: 'Draft', bg: 'bg-slate-600/20 border-slate-600/30', text: 'text-slate-400', icon: <Clock className="w-3 h-3" /> };
    default:
      return { label: 'Under Review', bg: 'bg-amber-500/20 border-amber-500/30', text: 'text-amber-400', icon: <Clock className="w-3 h-3" /> };
  }
}

function getRiskBadge(tier: number | undefined) {
  switch (tier) {
    case 1:
    case 2:
      return { label: 'Low Risk', bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-400' };
    case 3:
      return { label: 'Medium Risk', bg: 'bg-amber-500/20 border-amber-500/30', text: 'text-amber-400' };
    case 4:
      return { label: 'High Risk', bg: 'bg-red-500/20 border-red-500/30', text: 'text-red-400' };
    default:
      return { label: 'Unassessed', bg: 'bg-slate-500/20 border-slate-500/30', text: 'text-slate-400' };
  }
}

function dash(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

// ─── Compliance Donut ─────────────────────────────────────────────────────────

function ComplianceDonut({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const colour = pct >= 70 ? '#22d3ee' : pct >= 40 ? '#f59e0b' : '#f87171';
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="12" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={colour} strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color: colour }}>{pct}%</span>
          <span className="text-[10px] text-slate-400">Score</span>
        </div>
      </div>
      <span className="text-xs text-slate-400 mt-1">Compliance</span>
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'details' | 'inspections' | 'documents';

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({ icon, label, value, last = false }: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 py-3 ${last ? '' : 'border-b border-slate-700/50'}`}>
      {icon && <span className="mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className={`text-sm font-medium ${value === '—' ? 'text-slate-500' : 'text-white'}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function DetailCard({ icon, title, iconColor, children }: {
  icon: React.ReactNode;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className={iconColor}>{icon}</span>
        <h3 className="text-white font-semibold text-base">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── YesNo badge ──────────────────────────────────────────────────────────────

function YesNoBadge({ value }: { value: boolean | undefined | null }) {
  if (value === null || value === undefined) return <span className="text-slate-500 text-sm">—</span>;
  return value
    ? <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />Yes</span>
    : <span className="inline-flex items-center gap-1 bg-red-500/20 border border-red-500/30 text-red-400 text-xs rounded-full px-2 py-0.5"><XCircle className="w-3 h-3" />No</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShopProfilePage() {
  const router = useRouter();
  const params = useParams();
  const shopId = params.id as string;
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('details');

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/');
  }, [supabase, router]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (userData) setUser(userData);

      const { data: shopData, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', shopId)
        .single();

      if (error || !shopData) {
        router.push('/submissions');
        return;
      }
      setShop(shopData);
      setLoading(false);
    };
    init();
  }, [supabase, router, shopId]);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#e8ecf1] items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shop) return null;

  const statusBadge = getStatusBadge(shop.status);
  const riskBadge = getRiskBadge(shop.compliance_tier);
  const score = shop.compliance_score ?? 0;
  const mapsUrl = shop.gps_lat && shop.gps_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${shop.gps_lat},${shop.gps_lng}`
    : null;

  return (
    <div className="flex min-h-screen bg-[#e8ecf1]">
      <Sidebar activePage="shops" user={user} onLogout={handleLogout} />

      <main className="flex-1 md:ml-64 pt-20 md:pt-6 md:p-6 pb-24 lg:pb-8 px-4">
        <div className="max-w-2xl mx-auto">

          {/* ── Page Header ── */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Link
                href="/submissions"
                className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white transition-all shadow-[4px_4px_8px_#c5c9ce,-4px_-4px_8px_#ffffff]"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{shop.shop_name}</h1>
                {shop.owner_name && (
                  <p className="text-slate-400 text-sm">{shop.owner_name}</p>
                )}
              </div>
            </div>
            <Link
              href={`/shops/${shopId}/edit`}
              className="flex items-center gap-1.5 border border-slate-300 text-slate-500 hover:bg-slate-100 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>

          {/* ── Hero Card ── */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-700/50 rounded-xl overflow-hidden mb-5">
            <div className="flex flex-col md:flex-row">

              {/* Image */}
              <div className="w-full md:w-1/3 h-48 md:h-auto bg-slate-800 flex-shrink-0 relative">
                {shop.photo_front_url ? (
                  <Image src={shop.photo_front_url} alt="Shop front" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <ShoppingBag className="w-10 h-10 text-slate-600" />
                    <span className="text-slate-600 text-xs">No photo</span>
                  </div>
                )}
              </div>

              {/* Right side */}
              <div className="flex flex-col gap-4 p-4 md:p-6 flex-1">

                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-sm ${statusBadge.bg} ${statusBadge.text}`}>
                    {statusBadge.icon}
                    {statusBadge.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 border rounded-full px-3 py-1.5 text-sm ${riskBadge.bg} ${riskBadge.text}`}>
                    <TriangleAlert className="w-3 h-3" />
                    {riskBadge.label}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Compliance donut */}
                  <div className="col-span-2 md:col-span-1 flex items-center justify-center bg-slate-800/50 rounded-xl p-3">
                    <ComplianceDonut score={score} />
                  </div>

                  {/* Inspections */}
                  <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-cyan-400">{shop.inspection_count ?? 0}</span>
                    <span className="text-xs text-slate-400 mt-1">Inspections</span>
                  </div>

                  {/* Months Trading */}
                  <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-yellow-400">
                      {shop.years_operating ? `${Math.round(parseFloat(shop.years_operating) * 12)}` : '—'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">Months Trading</span>
                  </div>

                  {/* Municipality */}
                  <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-emerald-400">
                      {shop.municipality ? shop.municipality[0].toUpperCase() : '—'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1 truncate w-full">
                      {shop.municipality ?? 'Municipality'}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap">
                  <Link
                    href={`/assessment/new?shop_id=${shopId}`}
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Start Inspection
                  </Link>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-medium rounded-lg px-4 py-2 text-sm transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Navigate
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="bg-slate-800/40 rounded-xl p-1 flex gap-1 mb-5">
            {(['details', 'inspections', 'documents'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 px-4 rounded-lg text-sm font-medium capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Tab: Details ── */}
          {activeTab === 'details' && (
            <div className="grid md:grid-cols-2 gap-4">

              {/* Owner Information */}
              <DetailCard icon={<UserIcon className="w-4 h-4" />} title="Owner Information" iconColor="text-cyan-400">
                <FieldRow icon={<UserIcon className="w-4 h-4 text-slate-400" />} label="Full Name" value={dash(shop.owner_name)} />
                <FieldRow icon={<FileText className="w-4 h-4 text-slate-400" />} label="Contact" value={dash(shop.contact)} />
                <FieldRow icon={<FileText className="w-4 h-4 text-slate-400" />} label="Email" value={dash(shop.email)} />
                <FieldRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Address" value={dash(shop.address)} last />
              </DetailCard>

              {/* Location */}
              <DetailCard icon={<MapPin className="w-4 h-4" />} title="Location" iconColor="text-red-400">
                <FieldRow icon={<Building2 className="w-4 h-4 text-purple-400" />} label="Municipality" value={dash(shop.municipality)} />
                <FieldRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Ward" value={dash(shop.ward_no)} />
                <FieldRow
                  icon={<Navigation className="w-4 h-4 text-slate-400" />}
                  label="GPS Coordinates"
                  value={shop.gps_lat && shop.gps_lng ? `${shop.gps_lat.toFixed(6)}, ${shop.gps_lng.toFixed(6)}` : '—'}
                />
                <FieldRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Address" value={dash(shop.address)} last />
              </DetailCard>

              {/* Business Details */}
              <DetailCard icon={<ShoppingBag className="w-4 h-4" />} title="Business Details" iconColor="text-amber-400">
                <FieldRow icon={<Building2 className="w-4 h-4 text-slate-400" />} label="Structure Type" value={dash(shop.structure_type)} />
                <FieldRow icon={<Calendar className="w-4 h-4 text-slate-400" />} label="Years Operating" value={dash(shop.years_operating)} />
                <FieldRow icon={<Building2 className="w-4 h-4 text-slate-400" />} label="Store Size" value={dash(shop.store_size)} />
                <div className="py-3 border-b border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-1.5">Stock Categories</p>
                  <p className="text-sm text-white font-medium">
                    {shop.products?.length ? shop.products.join(', ') : 'None specified'}
                  </p>
                </div>
                <div className="py-3">
                  <p className="text-xs text-slate-400 mb-1.5">Storage</p>
                  <p className="text-sm text-white font-medium">
                    {shop.storage?.length ? shop.storage.join(', ') : 'None specified'}
                  </p>
                </div>
              </DetailCard>

              {/* Land & Tenure */}
              <DetailCard icon={<LayoutGrid className="w-4 h-4" />} title="Land & Tenure Security" iconColor="text-amber-400">
                <FieldRow icon={<Building2 className="w-4 h-4 text-slate-400" />} label="Ownership Type" value={dash(shop.structure_type)} />
                <FieldRow icon={<FileText className="w-4 h-4 text-slate-400" />} label="CIPC Registration" value={dash(shop.is_registered)} />
                <FieldRow icon={<FileText className="w-4 h-4 text-slate-400" />} label="CIPC Number" value={dash(shop.cipc_number)} last />
              </DetailCard>

              {/* Employee Demographics */}
              <DetailCard icon={<Users className="w-4 h-4" />} title="Employee Demographics" iconColor="text-purple-400">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{dash(shop.num_employees)}</p>
                    <p className="text-xs text-slate-400">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-cyan-400">0</p>
                    <p className="text-xs text-slate-400">Full-time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-400">0</p>
                    <p className="text-xs text-slate-400">Part-time</p>
                  </div>
                </div>
                <div className="space-y-0 divide-y divide-slate-700/50">
                  {[
                    ['Male / Female', '0 / 0'],
                    ['Youth (18–35)', '0'],
                    ['With Disabilities', '0'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between py-2.5">
                      <span className="text-xs text-slate-400">{label}</span>
                      <span className="text-sm font-medium text-white">{val}</span>
                    </div>
                  ))}
                </div>
              </DetailCard>

              {/* Photos */}
              <DetailCard icon={<FileText className="w-4 h-4" />} title="Photos" iconColor="text-blue-400">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Shop Front', url: shop.photo_front_url },
                    { label: 'Owner', url: shop.photo_owner_url },
                    { label: 'Interior', url: shop.photo_interior_url },
                  ].map(({ label, url }) => (
                    <div key={label} className="aspect-square rounded-lg bg-slate-700/50 overflow-hidden relative">
                      {url ? (
                        <Image src={url} alt={label} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                          <ShoppingBag className="w-5 h-5 text-slate-600" />
                          <p className="text-slate-500 text-[10px] text-center leading-tight">{label}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </DetailCard>

            </div>
          )}

          {/* ── Tab: Inspections ── */}
          {activeTab === 'inspections' && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold">Inspection History</h3>
                <Link
                  href={`/assessment/new?shop_id=${shopId}`}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  + New Inspection
                </Link>
              </div>

              {/* Empty state */}
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <ClipboardCheck className="w-12 h-12 text-slate-700" />
                <div className="text-center">
                  <p className="text-slate-300 font-medium">No inspections yet</p>
                  <p className="text-slate-500 text-sm mt-1">Start the first inspection for this shop</p>
                </div>
                <Link
                  href={`/assessment/new?shop_id=${shopId}`}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Start Inspection
                </Link>
              </div>
            </div>
          )}

          {/* ── Tab: Documents ── */}
          {activeTab === 'documents' && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <FileText className="w-4 h-4 text-green-400" />
                <h3 className="text-white font-semibold">Documents &amp; Compliance</h3>
              </div>

              {/* Trading Permit */}
              <div className="border-b border-slate-700/50 pb-4 mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Trading Permit</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Permit Number</span>
                    <span className="text-sm text-white font-medium">{dash(shop.permit_number)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Expiry Date</span>
                    <span className="text-sm text-white font-medium">{dash(shop.permit_expiry)}</span>
                  </div>
                </div>
              </div>

              {/* CoA */}
              <div className="border-b border-slate-700/50 pb-4 mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Certificate of Acceptability (CoA)</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Status</span>
                  {shop.has_coa
                    ? <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />Has CoA</span>
                    : <span className="inline-flex items-center gap-1 bg-red-500/20 border border-red-500/30 text-red-400 text-xs rounded-full px-2 py-0.5"><XCircle className="w-3 h-3" />No CoA</span>
                  }
                </div>
                {shop.coa_number && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">CoA Number</span>
                    <span className="text-sm text-white font-medium">{shop.coa_number}</span>
                  </div>
                )}
              </div>

              {/* NEF Eligibility */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">NEF Funding Eligibility</p>
                <div className="space-y-3">
                  {[
                    { label: 'Business Bank Account', value: shop.has_bank_account },
                    { label: 'SARS / Tax Registered', value: shop.tax_compliant },
                    { label: 'CIPC Registered', value: shop.is_registered },
                    { label: 'SA Citizen', value: shop.sa_citizen },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">{label}</span>
                      <YesNoBadge value={value} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-slate-400">CIPC Number</span>
                    <span className={`text-sm font-medium ${shop.cipc_number ? 'text-white' : 'text-slate-500'}`}>{dash(shop.cipc_number)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Footer credit ── */}
          <div className="mt-8 text-center pb-4">
            <p className="text-slate-400 text-sm">
              Powered by <span className="text-cyan-400 font-semibold">Kwahlelwa Group</span>
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
