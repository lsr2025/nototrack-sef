import Image from 'next/image';

export function AppFooter() {
  return (
    <footer className="w-full border-t border-gray-100 bg-white py-4 px-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: app credit */}
        <div className="flex items-center gap-2">
          <Image
            src="/yms-logo.jpg"
            alt="YamiMine Solutions"
            width={100}
            height={32}
            className="object-contain opacity-70"
          />
          <span className="text-gray-300 text-xs">|</span>
          <span className="text-xs text-gray-400">NotoTrack SEF &copy; {new Date().getFullYear()}</span>
        </div>

        {/* Right: Kwahlelwa Group credit */}
        <div className="flex items-center gap-2">
          <Image
            src="/kwahlelwa-logo.png"
            alt="Kwahlelwa Group"
            width={28}
            height={28}
            className="object-contain rounded-full opacity-80"
          />
          <div className="text-right">
            <p className="text-[11px] text-gray-500 font-medium leading-tight">
              Built by <span className="text-gray-700 font-semibold">Kwahlelwa Group</span>
            </p>
            <p className="text-[9px] text-gray-400 uppercase tracking-widest leading-tight">
              Patent Pending
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
