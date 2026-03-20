'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  full_name: string;
  role: string;
  municipality?: string;
  locality?: string;
}

interface AssessmentRow {
  id: string;
  compliance_score: number | null;
  compliance_tier: number | null;
  status: string;
  created_at: string;
  agent_id: string;
}

interface UserRow {
  id: string;
  full_name: string;
  municipality: string | null;
  locality: string | null;
}

interface MonthlyBreakdown {
  month: string;
  Compliant: number;
  Partial: number;
  'Non-Compliant': number;
}

interface MonthlyScore {
  month: string;
  avgScore: number;
}

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

interface AgentPerformance {
  rank: number;
  agent_id: string;
  full_name: string;
  municipality: string;
  assessments: number;
  avgScore: number;
  complianceRate: number;
  trend: 'up' | 'down' | 'neutral';
}

interface ReportCard {
  title: string;
  description: string;
  icon: React.ReactNode;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

function getLastNMonths(n: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`);
  }
  return result;
}

// ─── Tooltip components ───────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomBarTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
}

function CustomBarTooltip({ active, label, payload }: CustomBarTooltipProps) {
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

interface CustomLineTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
}

function CustomLineTooltip({ active, label, payload }: CustomLineTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        <p style={{ color: payload[0].color }} className="text-xs">
          Avg Score: <span className="font-bold">{payload[0].value.toFixed(1)}</span>
        </p>
      </div>
    );
  }
  return null;
}

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number }[];
}

function CustomPieTooltip({ active, payload }: CustomPieTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2 text-sm">
        <p className="font-semibold text-gray-800">{payload[0].name}</p>
        <p className="text-gray-500">{payload[0].value} assessments</p>
      </div>
    );
  }
  return null;
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function TrendUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function TrendDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ─── Report Cards data ────────────────────────────────────────────────────────

const REPORT_CARDS: ReportCard[] = [
  {
    title: 'Compliance Report (PDF)',
    description: 'Full compliance breakdown by municipality, tier distribution, and trend analysis over the selected period.',
    icon: <FileTextIcon />,
  },
  {
    title: 'Agent Activity Report',
    description: 'Detailed per-agent assessment activity, compliance scores, and performance rankings.',
    icon: <UsersIcon />,
  },
  {
    title: 'Municipality Summary',
    description: 'Geographic compliance summary grouped by municipality with risk hotspot identification.',
    icon: <MapPinIcon />,
  },
];

// ─── Compliance rate color helper ─────────────────────────────────────────────

function complianceRateColor(rate: number): string {
  if (rate >= 70) return 'text-green-600 bg-green-50';
  if (rate >= 40) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-300">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
      <p className="mt-3 text-sm">{label}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Chart data
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthlyBreakdown[]>([]);
  const [monthlyScores, setMonthlyScores] = useState<MonthlyScore[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<PieSlice[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<PieSlice[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);

  // Report card state
  const [reportDates, setReportDates] = useState<Record<number, { from: string; to: string }>>({
    0: { from: '', to: '' },
    1: { from: '', to: '' },
    2: { from: '', to: '' },
  });
  const [generatingReport, setGeneratingReport] = useState<number | null>(null);

  const loadAnalyticsData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      // Fetch user profile
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, role, municipality, locality')
        .eq('id', session.user.id)
        .single();
      if (userData) setUser(userData as UserProfile);

      // Fetch assessments (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);
      twelveMonthsAgo.setHours(0, 0, 0, 0);

      const { data: assessments } = await supabase
        .from('assessments')
        .select('id, compliance_score, compliance_tier, status, created_at, agent_id')
        .gte('created_at', twelveMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      // Fetch all users for agent join
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, municipality, locality');

      const assessmentList: AssessmentRow[] = (assessments ?? []) as AssessmentRow[];
      const userList: UserRow[] = (users ?? []) as UserRow[];
      const userMap: Record<string, UserRow> = {};
      userList.forEach((u) => { userMap[u.id] = u; });

      // ── Monthly Compliance Breakdown ──────────────────────────────────────
      const months = getLastNMonths(12);
      const monthBuckets: Record<string, { Compliant: number; Partial: number; 'Non-Compliant': number }> = {};
      months.forEach((m) => {
        monthBuckets[m] = { Compliant: 0, Partial: 0, 'Non-Compliant': 0 };
      });

      assessmentList.forEach((a) => {
        const key = getMonthKey(a.created_at);
        if (!monthBuckets[key]) return;
        const score = a.compliance_score ?? 0;
        if (score >= 70) monthBuckets[key].Compliant++;
        else if (score >= 40) monthBuckets[key].Partial++;
        else monthBuckets[key]['Non-Compliant']++;
      });

      setMonthlyBreakdown(
        months.map((m) => ({
          month: m.split(' ')[0], // short month label
          Compliant: monthBuckets[m].Compliant,
          Partial: monthBuckets[m].Partial,
          'Non-Compliant': monthBuckets[m]['Non-Compliant'],
        }))
      );

      // ── Average Score Trend ───────────────────────────────────────────────
      const scoreBuckets: Record<string, { total: number; count: number }> = {};
      months.forEach((m) => { scoreBuckets[m] = { total: 0, count: 0 }; });

      assessmentList.forEach((a) => {
        if (a.compliance_score === null) return;
        const key = getMonthKey(a.created_at);
        if (!scoreBuckets[key]) return;
        scoreBuckets[key].total += a.compliance_score;
        scoreBuckets[key].count++;
      });

      setMonthlyScores(
        months.map((m) => ({
          month: m.split(' ')[0],
          avgScore: scoreBuckets[m].count > 0
            ? Math.round((scoreBuckets[m].total / scoreBuckets[m].count) * 10) / 10
            : 0,
        }))
      );

      // ── Compliance Status Distribution ───────────────────────────────────
      let compliantCount = 0;
      let partialCount = 0;
      let pendingCount = 0;

      assessmentList.forEach((a) => {
        const score = a.compliance_score ?? -1;
        if (score >= 70) compliantCount++;
        else if (score >= 40) partialCount++;
        else pendingCount++;
      });

      setStatusDistribution([
        { name: 'Compliant', value: compliantCount, color: '#10B981' },
        { name: 'Partial', value: partialCount, color: '#F59E0B' },
        { name: 'Pending / Non-Compliant', value: pendingCount, color: '#6B7280' },
      ]);

      // ── Risk Level Distribution ───────────────────────────────────────────
      let lowRisk = 0;
      let mediumRisk = 0;
      let highRisk = 0;

      assessmentList.forEach((a) => {
        const score = a.compliance_score ?? -1;
        if (score >= 70) lowRisk++;
        else if (score >= 40) mediumRisk++;
        else highRisk++;
      });

      setRiskDistribution([
        { name: 'Low Risk', value: lowRisk, color: '#10B981' },
        { name: 'Medium Risk', value: mediumRisk, color: '#F59E0B' },
        { name: 'High Risk', value: highRisk, color: '#EF4444' },
      ]);

      // ── Agent Performance ─────────────────────────────────────────────────
      const agentMap: Record<string, { scores: number[]; total: number }> = {};

      assessmentList.forEach((a) => {
        if (!a.agent_id) return;
        if (!agentMap[a.agent_id]) agentMap[a.agent_id] = { scores: [], total: 0 };
        agentMap[a.agent_id].total++;
        if (a.compliance_score !== null) agentMap[a.agent_id].scores.push(a.compliance_score);
      });

      const agentEntries = Object.entries(agentMap)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10);

      const agentPerfList: AgentPerformance[] = agentEntries.map(([agentId, data], index) => {
        const u = userMap[agentId];
        const avgScore = data.scores.length > 0
          ? Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length)
          : 0;
        const complianceRate = data.scores.length > 0
          ? Math.round((data.scores.filter((s) => s >= 70).length / data.scores.length) * 100)
          : 0;
        // Simple trend: compare first half vs second half of scores
        const half = Math.floor(data.scores.length / 2);
        let trend: 'up' | 'down' | 'neutral' = 'neutral';
        if (half > 0) {
          const firstHalf = data.scores.slice(0, half).reduce((s, v) => s + v, 0) / half;
          const secondHalf = data.scores.slice(half).reduce((s, v) => s + v, 0) / (data.scores.length - half);
          if (secondHalf > firstHalf + 2) trend = 'up';
          else if (secondHalf < firstHalf - 2) trend = 'down';
        }
        return {
          rank: index + 1,
          agent_id: agentId,
          full_name: u?.full_name ?? 'Unknown Agent',
          municipality: u?.municipality ?? '—',
          assessments: data.total,
          avgScore,
          complianceRate,
          trend,
        };
      });

      setAgentPerformance(agentPerfList);
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  function handleGenerateReport(index: number) {
    setGeneratingReport(index);
    // Simulate generation delay
    setTimeout(() => {
      setGeneratingReport(null);
      alert(`"${REPORT_CARDS[index].title}" export is ready. (Connect your backend to produce real files.)`);
    }, 1500);
  }

  const statusTotal = statusDistribution.reduce((s, d) => s + d.value, 0);
  const riskTotal = riskDistribution.reduce((s, d) => s + d.value, 0);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#F4F6F9] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F4F6F9] overflow-hidden">
      {/* Sidebar */}
      <Sidebar activePage="analytics" user={user} onLogout={handleLogout} />

      {/* Main content */}
      <main className="flex-1 md:ml-64 overflow-y-auto">
        {/* ── Sticky header ── */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
              <p className="text-xs text-gray-400 mt-0.5">Compliance monitoring &amp; agent performance</p>
            </div>
            <button
              onClick={loadAnalyticsData}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">

          {/* ── Row 1 & 2: 2×2 Chart Grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* Chart 1: Monthly Compliance Breakdown (Stacked Bar) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Monthly Compliance Breakdown</h2>
                <p className="text-xs text-gray-400 mt-0.5">Compliant / Partial / Non-Compliant — last 12 months</p>
              </div>
              {monthlyBreakdown.every((m) => m.Compliant === 0 && m.Partial === 0 && m['Non-Compliant'] === 0) ? (
                <EmptyChart label="No compliance data available" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyBreakdown} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#6B7280', paddingTop: '10px' }} />
                    <Bar dataKey="Compliant" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Partial" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Non-Compliant" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Chart 2: Average Inspection Score Trend (Line) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Average Inspection Score Trend</h2>
                <p className="text-xs text-gray-400 mt-0.5">Monthly average compliance score (0–100)</p>
              </div>
              {monthlyScores.every((m) => m.avgScore === 0) ? (
                <EmptyChart label="No score data available" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthlyScores} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<CustomLineTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="avgScore"
                      name="Avg Score"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#2563EB' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Chart 3: Compliance Status Distribution (Donut) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Compliance Status Distribution</h2>
                <p className="text-xs text-gray-400 mt-0.5">Compliant / Partial / Pending breakdown</p>
              </div>
              {statusTotal === 0 ? (
                <EmptyChart label="No status data available" />
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative flex-shrink-0">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={statusDistribution.filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={54}
                          outerRadius={82}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {statusDistribution.filter((d) => d.value > 0).map((entry, index) => (
                            <Cell key={`status-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-xl font-bold text-gray-900">{statusTotal}</p>
                      <p className="text-xs text-gray-400">Total</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-2.5">
                    {statusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-gray-600">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{item.value}</span>
                          <span className="text-xs text-gray-400">
                            {statusTotal > 0 ? Math.round((item.value / statusTotal) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chart 4: Risk Level Distribution (Donut) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-gray-900">Risk Level Distribution</h2>
                <p className="text-xs text-gray-400 mt-0.5">Low / Medium / High risk breakdown</p>
              </div>
              {riskTotal === 0 ? (
                <EmptyChart label="No risk data available" />
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative flex-shrink-0">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={riskDistribution.filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={54}
                          outerRadius={82}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {riskDistribution.filter((d) => d.value > 0).map((entry, index) => (
                            <Cell key={`risk-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-xl font-bold text-gray-900">{riskTotal}</p>
                      <p className="text-xs text-gray-400">Total</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-2.5">
                    {riskDistribution.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-gray-600">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{item.value}</span>
                          <span className="text-xs text-gray-400">
                            {riskTotal > 0 ? Math.round((item.value / riskTotal) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 3: Agent Performance Table ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">Agent Performance</h2>
                <p className="text-xs text-gray-400 mt-0.5">Top 10 agents by assessment count — last 12 months</p>
              </div>
              <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2.5 py-1 rounded-full">
                Top 10
              </span>
            </div>

            {agentPerformance.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" className="mb-3">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <p className="text-gray-400 text-sm">No agent data available yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4 w-12">Rank</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Agent Name</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Municipality</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Assessments</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Avg Score</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Compliance Rate</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {agentPerformance.map((agent) => (
                      <tr key={agent.agent_id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            agent.rank === 1
                              ? 'bg-yellow-100 text-yellow-700'
                              : agent.rank === 2
                              ? 'bg-gray-100 text-gray-600'
                              : agent.rank === 3
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-50 text-gray-400'
                          }`}>
                            {agent.rank}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-semibold text-gray-900">{agent.full_name}</span>
                        </td>
                        <td className="py-3 pr-4 text-gray-500 text-xs">{agent.municipality}</td>
                        <td className="py-3 pr-4 font-semibold text-gray-900">{agent.assessments}</td>
                        <td className="py-3 pr-4">
                          <span className="font-semibold text-gray-900">{agent.avgScore}</span>
                          <span className="text-gray-400 text-xs">/100</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${complianceRateColor(agent.complianceRate)}`}>
                            {agent.complianceRate}%
                          </span>
                        </td>
                        <td className="py-3">
                          {agent.trend === 'up' ? (
                            <TrendUpIcon />
                          ) : agent.trend === 'down' ? (
                            <TrendDownIcon />
                          ) : (
                            <span className="text-gray-300 text-sm font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Row 4: Custom Reports ── */}
          <div>
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Custom Reports</h2>
              <p className="text-xs text-gray-400 mt-0.5">Select a date range and generate your report</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {REPORT_CARDS.map((card, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
                  {/* Icon + title */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                      {card.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{card.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{card.description}</p>
                    </div>
                  </div>

                  {/* Date range */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Range</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={reportDates[index].from}
                        onChange={(e) =>
                          setReportDates((prev) => ({
                            ...prev,
                            [index]: { ...prev[index], from: e.target.value },
                          }))
                        }
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                      <span className="text-gray-300 text-xs">to</span>
                      <input
                        type="date"
                        value={reportDates[index].to}
                        onChange={(e) =>
                          setReportDates((prev) => ({
                            ...prev,
                            [index]: { ...prev[index], to: e.target.value },
                          }))
                        }
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={() => handleGenerateReport(index)}
                    disabled={generatingReport === index}
                    className="mt-auto flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {generatingReport === index ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <DownloadIcon />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* CSV note */}
            <p className="mt-3 text-xs text-gray-400 text-center">
              CSV export available for all reports
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
