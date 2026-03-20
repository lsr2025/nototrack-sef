'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SyncIndicator } from '@/components/SyncIndicator';
import { User, Assessment } from '@/lib/types';
import { getAssessments } from '@/lib/offline-db';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserAndAssessments();
  }, []);

  async function loadUserAndAssessments() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      // Get user profile
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userData) {
        setUser(userData as User);
      }

      // Get submissions
      const { data: submissionsData } = await supabase
        .from('assessments')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false });

      // Also get local assessments
      const localAssessments = await getAssessments();

      const allAssessments = [
        ...(submissionsData || []),
        ...localAssessments.filter((a) => a.status !== 'synced'),
      ];

      setAssessments(allAssessments as Assessment[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const submittedCount = assessments.filter((a) => a.status === 'synced').length;
  const pendingCount = assessments.filter((a) => a.status === 'pending_sync').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-dark pt-2 pb-24">
      <OfflineBanner />

      {/* Header */}
      <div className="px-4 py-6 border-b border-teal/20">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Welcome, {user?.full_name?.split(' ')[0] || 'Agent'}
            </h1>
            <p className="text-white/60 text-sm">{user?.locality || 'Loading...'}</p>
          </div>
          <SyncIndicator />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-navy rounded-lg p-4 border border-teal/20">
            <div className="text-3xl font-bold text-teal">{submittedCount}</div>
            <div className="text-xs text-white/60 mt-1">Submissions Synced</div>
          </div>
          <div className="bg-navy rounded-lg p-4 border border-yellow-600/30">
            <div className="text-3xl font-bold text-yellow-500">{pendingCount}</div>
            <div className="text-xs text-white/60 mt-1">Pending Sync</div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => router.push('/assessment/new')}
          className="w-full py-4 bg-teal text-dark font-bold rounded-lg hover:bg-teal/90 transition text-lg"
        >
          + Start New Assessment
        </button>

        {/* Recent Submissions */}
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Recent Assessments</h2>
          {assessments.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <p>No assessments yet.</p>
              <p className="text-sm mt-1">Start by creating a new assessment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assessments.slice(0, 5).map((assessment) => (
                <div
                  key={assessment.offline_id || assessment.id}
                  className="bg-navy rounded-lg p-4 border border-white/10 flex items-start justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{assessment.shop_name}</p>
                    <p className="text-xs text-white/60 mt-1">
                      {assessment.created_at
                        ? new Date(assessment.created_at).toLocaleDateString()
                        : 'Just now'}
                    </p>
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      assessment.status === 'synced'
                        ? 'bg-green-600/20 text-green-300'
                        : 'bg-yellow-600/20 text-yellow-300'
                    }`}
                  >
                    {assessment.status === 'synced' ? '✓ Synced' : '⟳ Pending'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
