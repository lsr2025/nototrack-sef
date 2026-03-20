'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    // Check if already logged in
    checkSession();
  }, []);

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      router.push('/dashboard');
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!employeeId || !password) {
      setError('Please enter your employee ID and password');
      setLoading(false);
      return;
    }

    if (!isOnline) {
      setError('You are offline. Please connect to internet to sign in.');
      setLoading(false);
      return;
    }

    const email = `${employeeId.toLowerCase()}@nototrack.co.za`;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Invalid employee ID or password. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen bg-dark flex flex-col items-center justify-center px-4 py-8">
      <OfflineBanner />

      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="text-5xl font-bold text-teal mb-2">NotoTrack</div>
          <div className="text-lg font-semibold text-white/90 mb-1">
            YMS × IDC SEF Programme
          </div>
          <div className="text-sm text-white/70">Workstream A | Enterprise iLembe</div>
        </div>

        {/* Login card */}
        <div className="bg-navy rounded-lg p-6 shadow-lg">
          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Employee ID */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Employee ID
              </label>
              <input
                type="text"
                placeholder="YMS-A-P-001"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-4 py-3 bg-dark/50 border border-teal/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/30 transition"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-dark/50 border border-teal/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/30 transition"
                disabled={loading}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-600/20 border border-red-600/50 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-teal text-dark font-bold rounded-lg hover:bg-teal/90 transition disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Offline notice */}
          {!isOnline && (
            <div className="mt-4 p-3 bg-yellow-600/20 border border-yellow-600/50 rounded-lg text-yellow-200 text-xs text-center">
              Offline mode detected. You cannot sign in without internet connection.
            </div>
          )}
        </div>

        {/* Info text */}
        <div className="mt-8 text-center text-white/60 text-xs space-y-2">
          <p>Default password is your Employee ID</p>
          <p>Contact your supervisor for account assistance</p>
        </div>
      </div>
    </main>
  );
}
