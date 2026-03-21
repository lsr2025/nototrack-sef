'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import { AppFooter } from '@/components/AppFooter';
import { User, Assessment } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopRecord extends Assessment {
  agent_name?: string;
  agent_municipality?: string;
  agent_locality?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTierInfo(tier: number | null | undefined): {
  label: string;
  riskLabel: string;
  riskLevel: 'High' | 'Medium' | 'Low' | 'Unknown';
  badgeColor: string;
  riskBg: string;
  riskText: string;
} {
  switch (tier) {
    case 1:
      return {
        label: 'Tier 1 — Gold',
        riskLabel: 'Low Risk',
        riskLevel: 'Low',
        badgeColor: 'bg-yellow-500',
        riskBg: 'bg-green-900/40',
        riskText: 'text-green-300',
      };
    case 2:
      return {
        label: 'Tier 2 — Good',
        riskLabel: 'Low Risk',
        riskLevel: 'Low',
        badgeColor: 'bg-green-500',
        riskBg: 'bg-green-900/40',
        riskText: 'text-green-300',
      };
    case 3:
      return {
        label: 'Tier 3 — Partial',
        riskLabel: 'Medium Risk',
        riskLevel: 'Medium',
        badgeColor: 'bg-orange-400',
        riskBg: 'bg-orange-900/40',
        riskText: 'text-orange-300',
      };
    case 4:
      return {
        label: 'Tier 4 — Risk',
        riskLabel: 'High Risk',
        riskLevel: 'High',
        badgeColor: 'bg-red-500',
        riskBg: 'bg-red-900/40',
        riskText: 'text-red-300',
      };
    default:
      return {
        label: 'Unassessed',
        riskLabel: 'Unknown',
        riskLevel: 'Unknown',
        badgeColor: 'bg-gray-500',
        riskBg: 'bg-gray-700/40',
        riskText: 'text-gray-400',
      };
  }
}

function getStatusInfo(status: string): { label: string; bg: string; text: string } {
  switch (status) {
    case 'synced':
      return { label: 'Synced', bg: 'bg-green-900/40', text: 'text-green-300' };
    case 'submitted':
      return { label: 'Submitted', bg: 'bg-blue-900/40', text: 'text-blue-300' };
    case 'pending_sync':
      return { label: 'Pending', bg: 'bg-yellow-900/40', text: 'text-yellow-300' };
    case 'draft':
      return { label: 'Draft', bg: 'bg-gray-700/40', text: 'text-gray-400' };
    case 'failed':
      return { label: 'Failed', bg: 'bg-red-900/40', text: 'text-red-300' };
    default:
      return { label: status, bg: 'bg-gray-700/40', text: 'text-gray-400' };
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─── Search Icon ──────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ─── Shop Card ────────────────────────────────────────────────────────────────

function ShopCard({ shop }: { shop: ShopRecord }) {
  const tierInfo = getTierInfo(shop.compliance_tier);
  const statusInfo = getStatusInfo(shop.status);
  const agentInitials = shop.agent_name ? getInitials(shop.agent_name) : '?';

  return (
    <div className="bg-[#1A2D5A] rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all hover:shadow-lg hover:shadow-black/20 group">
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <h3 className="font-bold text-[#0D7A6B] text-base leading-tight truncate group-hover:text-teal-400 transition-colors">
            {shop.shop_name}
          </h3>
          {shop.owner_name && (
            <p className="text-gray-400 text-xs mt-0.5">{shop.owner_name}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
            {statusInfo.label}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tierInfo.riskBg} ${tierInfo.riskText}`}>
            {tierInfo.riskLabel}
          </span>
        </div>
      </div>

      {/* Score bar */}
      {shop.compliance_score !== undefined && shop.compliance_score !== null && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Compliance Score</span>
            <span className="text-xs font-bold text-white">{shop.compliance_score}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${shop.compliance_score}%`,
                backgroundColor:
                  shop.compliance_score >= 70
                    ? '#10B981'
                    : shop.compliance_score >= 40
                    ? '#F59E0B'
                    : '#EF4444',
              }}
            />
          </div>
        </div>
      )}

      {/* Details */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{agentInitials}</span>
          </div>
          <div>
            <p className="text-xs text-gray-300 font-medium">
              {shop.agent_name || 'Unknown Agent'}
            </p>
            <p className="text-xs text-gray-500">
              {shop.agent_locality || shop.address || 'No location'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${tierInfo.badgeColor} text-white`}
          >
            {shop.compliance_tier ? `T${shop.compliance_tier}` : 'N/A'}
          </span>
          <p className="text-xs text-gray-500 mt-0.5">
            {shop.created_at
              ? new Date(shop.created_at).toLocaleDateString('en-ZA', {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Shops Content ────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function ShopsContent() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<ShopRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [municipalityFilter, setMunicipalityFilter] = useState('All Municipalities');
  const [riskFilter, setRiskFilter] = useState('All Risk Levels');

  const fetchShops = useCallback(
    async (pageNum: number, replace: boolean) => {
      try {
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
          .from('assessments')
          .select('*')
          .order('submitted_at', { ascending: false })
          .range(from, to);

        if (statusFilter !== 'All Status') {
          const statusMap: Record<string, string> = {
            Compliant: 'synced',
            Partial: 'submitted',
            Pending: 'pending_sync',
            Draft: 'draft',
          };
          query = query.eq('status', statusMap[statusFilter] || statusFilter.toLowerCase());
        }

        if (riskFilter !== 'All Risk Levels') {
          const tierMap: Record<string, number[]> = {
            Low: [1, 2],
            Medium: [3],
            High: [4],
          };
          const tiers = tierMap[riskFilter];
          if (tiers) query = query.in('compliance_tier', tiers);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching shops:', error);
          return;
        }

        if (!data || data.length < PAGE_SIZE) setHasMore(false);

        const mapped: ShopRecord[] = (data || []).map((r: Assessment) => ({
          ...r,
          agent_name: (r as Assessment & { fieldworker_name?: string }).fieldworker_name ?? undefined,
          agent_municipality: (r as Assessment & { municipality?: string }).municipality ?? undefined,
          agent_locality: undefined,
        }));

        if (replace) {
          setShops(mapped);
        } else {
          setShops((prev) => [...prev, ...mapped]);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    },
    [supabase, statusFilter, riskFilter]
  );

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (userData) setUser(userData as User);

      setPage(0);
      setHasMore(true);
      setLoading(true);
      await fetchShops(0, true);
      setLoading(false);
    };
    init();
  }, [router, supabase, fetchShops]);

  // Re-fetch when filters change
  useEffect(() => {
    if (!loading) {
      setPage(0);
      setHasMore(true);
      fetchShops(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, municipalityFilter, riskFilter]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchShops(nextPage, false);
    setLoadingMore(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  // Client-side search filter
  const filtered = shops.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.shop_name?.toLowerCase().includes(q) ||
      s.owner_name?.toLowerCase().includes(q) ||
      s.agent_name?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activePage="shops" user={user} onLogout={handleLogout} />

      <main className="flex-1 md:ml-64 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Shops</h1>
              <p className="text-xs text-gray-400 mt-0.5">All assessed spaza shops</p>
            </div>
            <button
              onClick={() => router.push('/assessment/new')}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <span className="text-base">+</span>
              New Assessment
            </button>
          </div>
        </header>

        <div className="p-6">
          {/* Search + Filters bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  placeholder="Search shops, owners, agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
              >
                <option>All Status</option>
                <option>Compliant</option>
                <option>Partial</option>
                <option>Pending</option>
                <option>Draft</option>
              </select>

              {/* Municipality filter */}
              <select
                value={municipalityFilter}
                onChange={(e) => setMunicipalityFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
              >
                <option>All Municipalities</option>
                <option>KwaDukuza</option>
                <option>Mandeni</option>
                <option>Maphumulo</option>
                <option>Ndwedwe</option>
              </select>

              {/* Risk level filter */}
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
              >
                <option>All Risk Levels</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
          </div>

          {/* Count */}
          <p className="text-sm text-gray-500 mb-4 font-medium">
            Showing{' '}
            <span className="text-gray-900 font-bold">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'shop' : 'shops'}
            {search && (
              <span className="text-gray-400">
                {' '}for &ldquo;{search}&rdquo;
              </span>
            )}
          </p>

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[#1A2D5A] rounded-2xl p-5 border border-white/10 animate-pulse h-44"
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="text-6xl mb-4">🏪</span>
              <h3 className="text-lg font-bold text-gray-700 mb-2">No shops found</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                {search
                  ? `No results for "${search}". Try a different search term.`
                  : 'No shops match your current filters. Try adjusting the filters above.'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="mt-4 text-blue-600 text-sm font-medium hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* Grid */}
          {!loading && filtered.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((shop) => (
                  <ShopCard key={shop.id || shop.offline_id} shop={shop} />
                ))}
              </div>

              {/* Load more */}
              {hasMore && !search && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load more shops'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <AppFooter />
      </main>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function ShopsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen bg-background items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading shops...</p>
          </div>
        </div>
      }
    >
      <ShopsContent />
    </Suspense>
  );
}
