'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import { User, Assessment } from '@/lib/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  activeAgents: number;
  totalAssessments: number;
  todayAssessments: number;
  complianceRate: number;
  criticalRisk: number;
  pendingSync: number;
  compliantCount: number;
}

interface TrendPoint {
  date: string;
  assessments: number;
  synced: number;
}

interface TierBreakdown {
  tier1: number; // Gold / Compliant
  tier2: number; // Green / Good
  tier3: number; // Orange / Partial
  tier4: number; // Red / Risk
}

interface AgentStat {
  agent_id: string;
  full_name: string;
  total: number;
  thisWeek: number;
}

interface RecentAssessment {
  id: string;
  shop_name: string;
  agent_name: string;
  compliance_score: number | null;
  compliance_tier: number | null;
  status: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    month: 'short',
    day: '2-digit',
  });
}

function getTierLabel(tier: number | null): { label: string; color: string; bg: string } {
  switch (tier) {
    case 1:
      return { label: 'Gold', color: 'text-yellow-700', bg: 'bg-yellow-100' };
    case 2:
      return { label: 'Good', color: 'text-green-700', bg: 'bg-green-100' };
    case 3:
      return { label: 'Partial', color: 'text-orange-700', bg: 'bg-orange-100' };
    case 4:
      return { label: 'Risk', color: 'text-red-700', bg: 'bg-red-100' };
    default:
      return { label: 'N/A', color: 'text-gray-500', bg: 'bg-gray-100' };
  }
}

function getStatusStyle(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'synced':
      return { label: 'Synced', color: 'text-green-700', bg: 'bg-green-100' };
    case 'submitted':
      return { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100' };
    case 'pending_sync':
      return { label: 'Pending', color: 'text-orange-700', bg: 'bg-orange-100' };
    case 'draft':
      return { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' };
    case 'failed':
      return { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100' };
    default:
      return { label: status, color: 'text-gray-600', bg: 'bg-gray-100' };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  badge: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

function KpiCard({ title, value, subtitle, badge, iconBg, iconColor, icon, trend, trendUp }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
          <span className={`text-xl ${iconColor}`}>{icon}</span>
        </div>
        {trend && (
          <span className={`text-xs font-semibold ${trendUp ? 'text-green-500' : 'text-red-400'}`}>
            {trendUp ? '↗' : '↘'} {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide font-semibold">{title}</p>
      </div>
      <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">{subtitle}</p>
        <span className="text-xs text-blue-600 font-medium">{badge}</span>
      </div>
    </div>
  );
}

// ─── Donut tooltip ────────────────────────────────────────────────────────────

interface DonutPayloadItem {
  name: string;
  value: number;
}

interface CustomDonutTooltipProps {
  active?: boolean;
  payload?: DonutPayloadItem[];
}

function CustomDonutTooltip({ active, payload }: CustomDonutTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2 text-sm">
        <p className="font-semibold text-gray-800">{payload[0].name}</p>
        <p className="text-gray-500">{payload[0].value} shops</p>
      </div>
    );
  }
  return null;
}

// ─── Line tooltip ─────────────────────────────────────────────────────────────

interface LinePayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomLineTooltipProps {
  active?: boolean;
  label?: string;
  payload?: LinePayloadItem[];
}

function CustomLineTooltip({ active, label, payload }: CustomLineTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }} className="text-xs">
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [kpi, setKpi] = useState<KpiData>({
    activeAgents: 0,
    totalAssessments: 0,
    todayAssessments: 0,
    complianceRate: 0,
    criticalRisk: 0,
    pendingSync: 0,
    compliantCount: 0,
  });
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [tierBreakdown, setTierBreakdown] = useState<TierBreakdown>({ tier1: 0, tier2: 0, tier3: 0, tier4: 0 });
  const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>([]);
  const [agentLeaderboard, setAgentLeaderboard] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [municipalityFilter, setMunicipalityFilter] = useState('All Municipalities');
  const [timeFilter, setTimeFilter] = useState('Last 30 Days');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadDashboardData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      // User profile
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (userData) setUser(userData as User);

      // Date boundaries
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Active agents
      const { count: agentCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      // Total assessments
      const { count: totalCount } = await supabase
        .from('assessments')
        .select('id', { count: 'exact', head: true });

      // Today's assessments
      const { count: todayCount } = await supabase
        .from('assessments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart);

      // Compliance scores
      const { data: scoreData } = await supabase
        .from('assessments')
        .select('compliance_score')
        .not('compliance_score', 'is', null);

      let complianceRate = 0;
      let criticalRisk = 0;
      let compliantCount = 0;
      if (scoreData && scoreData.length > 0) {
        const scores = scoreData.map((r: { compliance_score: number }) => r.compliance_score);
        complianceRate = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
        criticalRisk = scores.filter((s: number) => s < 40).length;
        compliantCount = scores.filter((s: number) => s >= 70).length;
      }

      // Pending / draft count
      const { count: pendingCount } = await supabase
        .from('assessments')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending_sync', 'draft']);

      setKpi({
        activeAgents: agentCount ?? 0,
        totalAssessments: totalCount ?? 0,
        todayAssessments: todayCount ?? 0,
        complianceRate,
        criticalRisk,
        pendingSync: pendingCount ?? 0,
        compliantCount,
      });

      // Trend data (last 30 days)
      const { data: trendRaw } = await supabase
        .from('assessments')
        .select('created_at, status')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true });

      if (trendRaw) {
        const buckets: Record<string, { assessments: number; synced: number }> = {};
        // seed every day of last 30
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const key = d.toISOString().slice(0, 10);
          buckets[key] = { assessments: 0, synced: 0 };
        }
        trendRaw.forEach((row: { created_at: string; status: string }) => {
          const key = row.created_at.slice(0, 10);
          if (buckets[key]) {
            buckets[key].assessments += 1;
            if (row.status === 'synced') buckets[key].synced += 1;
          }
        });
        const trendPoints: TrendPoint[] = Object.entries(buckets).map(([date, val]) => ({
          date: formatDate(date + 'T00:00:00'),
          assessments: val.assessments,
          synced: val.synced,
        }));
        setTrend(trendPoints);
      }

      // Tier breakdown
      const { data: tierData } = await supabase
        .from('assessments')
        .select('compliance_tier')
        .not('compliance_tier', 'is', null);

      if (tierData) {
        const breakdown: TierBreakdown = { tier1: 0, tier2: 0, tier3: 0, tier4: 0 };
        tierData.forEach((row: { compliance_tier: number }) => {
          if (row.compliance_tier === 1) breakdown.tier1++;
          else if (row.compliance_tier === 2) breakdown.tier2++;
          else if (row.compliance_tier === 3) breakdown.tier3++;
          else if (row.compliance_tier === 4) breakdown.tier4++;
        });
        setTierBreakdown(breakdown);
      }

      // Recent assessments with agent join
      const { data: recentRaw } = await supabase
        .from('assessments')
        .select('id, shop_name, agent_id, compliance_score, compliance_tier, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentRaw && recentRaw.length > 0) {
        const agentIds = [...new Set(recentRaw.map((r: { agent_id: string }) => r.agent_id))];
        const { data: agentNames } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', agentIds);
        const nameMap: Record<string, string> = {};
        if (agentNames) {
          agentNames.forEach((a: { id: string; full_name: string }) => {
            nameMap[a.id] = a.full_name;
          });
        }
        setRecentAssessments(
          recentRaw.map((r: { id: string; shop_name: string; agent_id: string; compliance_score: number | null; compliance_tier: number | null; status: string; created_at: string }) => ({
            id: r.id,
            shop_name: r.shop_name,
            agent_name: nameMap[r.agent_id] || 'Unknown',
            compliance_score: r.compliance_score,
            compliance_tier: r.compliance_tier,
            status: r.status,
            created_at: r.created_at,
          }))
        );
      }

      // Agent leaderboard
      const { data: allForAgents } = await supabase
        .from('assessments')
        .select('agent_id, created_at')
        .gte('created_at', thirtyDaysAgo);

      if (allForAgents) {
        const agentTotals: Record<string, { total: number; thisWeek: number }> = {};
        allForAgents.forEach((row: { agent_id: string; created_at: string }) => {
          if (!agentTotals[row.agent_id]) agentTotals[row.agent_id] = { total: 0, thisWeek: 0 };
          agentTotals[row.agent_id].total++;
          if (row.created_at >= weekAgo) agentTotals[row.agent_id].thisWeek++;
        });

        const topAgentIds = Object.entries(agentTotals)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 5)
          .map(([id]) => id);

        if (topAgentIds.length > 0) {
          const { data: topNames } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', topAgentIds);
          const topNameMap: Record<string, string> = {};
          if (topNames) {
            topNames.forEach((a: { id: string; full_name: string }) => {
              topNameMap[a.id] = a.full_name;
            });
          }
          setAgentLeaderboard(
            topAgentIds.map((id) => ({
              agent_id: id,
              full_name: topNameMap[id] || 'Agent',
              total: agentTotals[id].total,
              thisWeek: agentTotals[id].thisWeek,
            }))
          );
        }
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const donutData = [
    { name: 'Gold — Tier 1', value: tierBreakdown.tier1, color: '#D97706' },
    { name: 'Good — Tier 2', value: tierBreakdown.tier2, color: '#10B981' },
    { name: 'Partial — Tier 3', value: tierBreakdown.tier3, color: '#F59E0B' },
    { name: 'Risk — Tier 4', value: tierBreakdown.tier4, color: '#EF4444' },
  ];

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  if (loading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar activePage="dashboard" user={user} onLogout={handleLogout} />

      {/* Main */}
      <main className="flex-1 md:ml-64 overflow-y-auto">
        {/* ── Top Header ── */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Super Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Comprehensive Operations Overview</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Municipality filter */}
              <select
                value={municipalityFilter}
                onChange={(e) => setMunicipalityFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>All Municipalities</option>
                <option>KwaDukuza</option>
                <option>Mandeni</option>
                <option>Maphumulo</option>
                <option>Ndwedwe</option>
              </select>

              {/* Time range filter */}
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Last 30 Days</option>
                <option>Last 7 Days</option>
                <option>Last 90 Days</option>
                <option>This Year</option>
              </select>

              {/* Live indicator */}
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
                <span className="text-xs font-semibold text-green-700">Live</span>
              </div>

              {/* Refresh */}
              <button
                onClick={loadDashboardData}
                className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Refresh
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-300 mt-2">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </header>

        <div className="p-6 space-y-6">
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <KpiCard
              title="Active Agents"
              value={kpi.activeAgents}
              subtitle={`${kpi.todayAssessments} checked in today`}
              badge="+2 this week"
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              icon="👥"
              trend="12%"
              trendUp
            />
            <KpiCard
              title="Total Assessments"
              value={kpi.totalAssessments}
              subtitle={`${kpi.compliantCount} compliant`}
              badge="Active portfolio"
              iconBg="bg-green-100"
              iconColor="text-green-600"
              icon="🏪"
              trend="8%"
              trendUp
            />
            <KpiCard
              title="Compliance Rate"
              value={`${kpi.complianceRate}%`}
              subtitle={`${kpi.criticalRisk} critical risk (score < 40)`}
              badge="Avg score"
              iconBg="bg-orange-100"
              iconColor="text-orange-600"
              icon="🛡️"
              trend={kpi.complianceRate > 60 ? '3%' : '5%'}
              trendUp={kpi.complianceRate > 60}
            />
            <KpiCard
              title="Pending Sync"
              value={kpi.pendingSync}
              subtitle="Awaiting upload"
              badge="Action needed"
              iconBg="bg-red-100"
              iconColor="text-red-600"
              icon="⚠️"
            />
          </div>

          {/* ── Charts Row ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* Activity Trend — 60% */}
            <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Activity Trend</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Assessments vs Synced — Last 30 days</p>
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2.5 py-1 rounded-full">
                  30d
                </span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', color: '#6B7280', paddingTop: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="assessments"
                    name="Assessments"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#2563EB' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="synced"
                    name="Synced"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#10B981' }}
                    strokeDasharray="5 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Compliance Donut — 40% */}
            <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Compliance Status</h2>
                <p className="text-xs text-gray-400 mt-0.5">Shops by compliance tier</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie
                        data={donutData.filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {donutData.filter((d) => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomDonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-2xl font-bold text-gray-900">{donutTotal}</p>
                    <p className="text-xs text-gray-400">Total</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="w-full mt-4 space-y-2">
                  {donutData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-gray-600 text-xs">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-xs">{item.value}</span>
                        <span className="text-gray-400 text-xs">
                          {donutTotal > 0 ? Math.round((item.value / donutTotal) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Bottom Row ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* Recent Assessments table — 60% */}
            <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Recent Assessments</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Last 5 submitted</p>
                </div>
                <button
                  onClick={() => router.push('/submissions')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View all →
                </button>
              </div>

              {recentAssessments.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-center">
                  <span className="text-4xl mb-3">📋</span>
                  <p className="text-gray-400 text-sm">No assessments yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Shop</th>
                        <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Agent</th>
                        <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Score</th>
                        <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Tier</th>
                        <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Status</th>
                        <th className="text-left text-xs font-semibold text-gray-400 pb-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentAssessments.map((a) => {
                        const tier = getTierLabel(a.compliance_tier);
                        const status = getStatusStyle(a.status);
                        return (
                          <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-4 font-medium text-gray-900 max-w-[120px] truncate">
                              {a.shop_name}
                            </td>
                            <td className="py-3 pr-4 text-gray-500 text-xs max-w-[100px] truncate">
                              {a.agent_name}
                            </td>
                            <td className="py-3 pr-4">
                              {a.compliance_score !== null ? (
                                <span className="font-bold text-gray-900">{a.compliance_score}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tier.bg} ${tier.color}`}>
                                {tier.label}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className="py-3 text-gray-400 text-xs whitespace-nowrap">
                              {a.created_at ? formatDate(a.created_at) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Agent Leaderboard — 40% */}
            <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Agent Leaderboard</h2>
                <p className="text-xs text-gray-400 mt-0.5">Top 5 agents — last 30 days</p>
              </div>

              {agentLeaderboard.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-center">
                  <span className="text-4xl mb-3">🏆</span>
                  <p className="text-gray-400 text-sm">No data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agentLeaderboard.map((agent, index) => {
                    const rankColors = [
                      'bg-yellow-100 text-yellow-700',
                      'bg-gray-100 text-gray-600',
                      'bg-orange-100 text-orange-700',
                      'bg-gray-50 text-gray-500',
                      'bg-gray-50 text-gray-500',
                    ];
                    const rankEmojis = ['🥇', '🥈', '🥉', '4', '5'];
                    return (
                      <div
                        key={agent.agent_id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${rankColors[index]}`}
                        >
                          {rankEmojis[index]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{agent.full_name}</p>
                          <p className="text-xs text-gray-400">{agent.total} assessments total</p>
                        </div>
                        {agent.thisWeek > 0 && (
                          <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
                            +{agent.thisWeek} wk
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
