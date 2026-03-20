'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-navy border-t border-teal/20 px-4 py-3 flex justify-around items-center gap-2">
      <Link
        href="/dashboard"
        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
          isActive('/dashboard')
            ? 'text-teal'
            : 'text-white/60 hover:text-white'
        }`}
      >
        <span className="text-xl">🏠</span>
        <span className="text-xs font-medium">Home</span>
      </Link>

      <Link
        href="/assessment/new"
        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
          isActive('/assessment')
            ? 'text-teal'
            : 'text-white/60 hover:text-white'
        }`}
      >
        <span className="text-xl">+</span>
        <span className="text-xs font-medium">New</span>
      </Link>

      <Link
        href="/submissions"
        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
          isActive('/submissions')
            ? 'text-teal'
            : 'text-white/60 hover:text-white'
        }`}
      >
        <span className="text-xl">📋</span>
        <span className="text-xs font-medium">Submissions</span>
      </Link>

      <Link
        href="/profile"
        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
          isActive('/profile')
            ? 'text-teal'
            : 'text-white/60 hover:text-white'
        }`}
      >
        <span className="text-xl">👤</span>
        <span className="text-xs font-medium">Profile</span>
      </Link>
    </nav>
  );
}
