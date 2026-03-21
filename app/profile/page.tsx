'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { User } from '@/lib/types';
import { getPendingCount } from '@/lib/offline-db';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userData) {
        setUser(userData as User);
      }

      const pending = await getPendingCount();
      setPendingCount(pending);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const roleTierNames: Record<number, string> = {
    1: 'Executive',
    2: 'District Coordinator',
    3: 'Field Supervisor',
    4: 'Field Agent / Participant',
    5: 'M&E / Funder',
  };

  return (
    <div className="flex min-h-screen bg-dark">
      <Sidebar activePage="hr" user={user ? { full_name: user.full_name, role: user.role } : null} onLogout={handleSignOut} />
      <main className="flex-1 md:ml-64 pt-16 md:pt-2 pb-24 overflow-y-auto">
      <OfflineBanner />

      {/* Header */}
      <div className="px-4 py-6 border-b border-teal/20 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <Link href="/dashboard" className="text-teal hover:text-teal/80">
          ← Back
        </Link>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Profile card */}
        <div className="bg-navy rounded-lg p-6 border border-teal/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-teal/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.full_name || 'User'}</h2>
              <p className="text-teal text-sm font-medium">{user?.employee_id}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <ProfileItem label="Role" value={roleTierNames[user?.role_tier || 4]} />
            <ProfileItem label="Workstream" value={user?.workstream || '-'} />
            <ProfileItem label="Municipality" value={user?.municipality || '-'} />
            <ProfileItem label="Locality" value={user?.locality || '-'} />
            {user?.ward && <ProfileItem label="Ward" value={user.ward} />}
          </div>
        </div>

        {/* Offline data status */}
        <div className="bg-navy rounded-lg p-4 border border-yellow-600/30">
          <h3 className="font-semibold text-white mb-2">Offline Data</h3>
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-sm">Pending Sync</span>
            <span className="text-lg font-bold text-yellow-500">{pendingCount}</span>
          </div>
          {pendingCount > 0 && (
            <p className="text-xs text-white/60 mt-2">
              Will sync automatically when internet connection is restored.
            </p>
          )}
        </div>

        {/* Account info */}
        <div className="bg-navy rounded-lg p-4 border border-white/10">
          <h3 className="font-semibold text-white mb-3">Account</h3>
          <p className="text-xs text-white/60 mb-3">Email: {user?.email || 'Loading...'}</p>
          <button
            onClick={handleSignOut}
            className="w-full py-3 bg-red-600/20 text-red-300 font-bold rounded-lg hover:bg-red-600/30 transition border border-red-600/50"
          >
            Sign Out
          </button>
        </div>

        {/* App info */}
        <div className="text-center pt-4 border-t border-white/10">
          <p className="text-white/60 text-xs">
            NotoTrack v1.0.0 • YMS × IDC SEF Programme
          </p>
          <p className="text-white/60 text-xs mt-1">
            Workstream A • Enterprise iLembe
          </p>
        </div>
      </div>

      </main>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/70 text-sm">{label}</span>
      <span className="text-white font-semibold text-right">{value}</span>
    </div>
  );
}
