'use client';

import { useEffect, useState } from 'react';
import { getPendingCount } from '@/lib/offline-db';

export function SyncIndicator() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkPending = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);

    return () => clearInterval(interval);
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div className="inline-flex items-center gap-2 bg-yellow-600/20 border border-yellow-600/50 rounded-full px-3 py-1 text-yellow-300 text-sm font-medium">
      <span className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse" />
      {pendingCount} pending
    </div>
  );
}
