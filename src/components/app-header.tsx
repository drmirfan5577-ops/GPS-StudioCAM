import { useState, useEffect } from 'react';

export default function AppHeader() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-sidebar border-b border-sidebar-border shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-lg">
          📍
        </div>
        <div>
          <div className="text-sm font-black text-sidebar-foreground tracking-tight leading-none">
            ES GPS CAM
          </div>
          <div className="text-[9px] text-sidebar-foreground/50 leading-none mt-0.5">
            A project of ES OneWorld
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}
        />
        <span className="text-[10px] text-sidebar-foreground/60 font-medium">
          {online ? 'Online' : 'Offline'}
        </span>
      </div>
    </header>
  );
}
