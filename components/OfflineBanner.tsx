'use client';

import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOnlineNotice, setShowOnlineNotice] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineNotice(true);
      setTimeout(() => setShowOnlineNotice(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showOnlineNotice) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center text-white text-sm font-medium ${
        isOnline ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {isOnline ? '✓ Back online! Data will sync now.' : '⚠ Offline mode. Data will sync when connection is restored.'}
    </div>
  );
}
