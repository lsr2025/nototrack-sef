'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Assessment } from '@/lib/types';
import { getAssessments } from '@/lib/offline-db';
import { getComplianceTier } from '@/lib/compliance';

function SubmissionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const showSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    loadAssessments();
  }, []);

  async function loadAssessments() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      // Get remote assessments
      const { data: remoteData } = await supabase
        .from('assessments')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false });

      // Get local assessments
      const localData = await getAssessments();

      // Combine and deduplicate
      const allAssessments = [
        ...(remoteData || []),
        ...localData.filter((a) => a.status !== 'synced'),
      ];

      // Remove duplicates (prefer synced versions)
      const unique = allAssessments.reduce(
        (acc, current) => {
          const exists = acc.find((item) => item.offline_id === current.offline_id || item.id === current.id);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        },
        [] as Assessment[]
      );

      setAssessments(unique as Assessment[]);
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
    }
  }

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
      <div className="px-4 py-6 border-b border-teal/20 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Submissions</h1>
        <Link href="/dashboard" className="text-teal hover:text-teal/80">
          ← Back
        </Link>
      </div>

      {/* Success message */}
      {showSuccess && (
        <div className="mx-4 mt-4 p-4 bg-green-600/20 border border-green-600/50 rounded-lg text-green-200">
          ✓ Assessment submitted successfully!
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-6">
        {assessments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60 text-lg mb-4">No assessments yet</p>
            <Link
              href="/assessment/new"
              className="inline-block px-6 py-3 bg-teal text-dark font-bold rounded-lg hover:bg-teal/90 transition"
            >
              Create Your First Assessment
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {assessments.map((assessment) => {
              const tier =
                assessment.compliance_score !== undefined
                  ? getComplianceTier(assessment.compliance_score)
                  : null;

              return (
                <div
                  key={assessment.offline_id || assessment.id}
                  className="bg-navy rounded-lg p-4 border border-white/10 hover:border-teal/50 transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-white">{assessment.shop_name}</h3>
                      <p className="text-white/60 text-xs mt-1">
                        {assessment.created_at
                          ? new Date(assessment.created_at).toLocaleDateString('en-ZA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Draft'}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        assessment.status === 'synced'
                          ? 'bg-green-600/20 text-green-300'
                          : 'bg-yellow-600/20 text-yellow-300'
                      }`}
                    >
                      {assessment.status === 'synced' ? '✓ Synced' : '⟳ Pending'}
                    </span>
                  </div>

                  {assessment.compliance_score !== undefined && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
                      <div>
                        <p className="text-2xl font-bold text-teal">
                          {assessment.compliance_score}
                        </p>
                        <p className="text-xs text-white/60">Compliance Score</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-white/80">{tier?.label}</p>
                        <p className="text-xs text-white/60">{tier?.description}</p>
                      </div>
                    </div>
                  )}

                  {assessment.owner_name && (
                    <p className="text-xs text-white/60 mt-2">Owner: {assessment.owner_name}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

export default function SubmissionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <SubmissionsContent />
    </Suspense>
  );
}
