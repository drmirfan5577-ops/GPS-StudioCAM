import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, MapPin, Image, Play, Film, Settings, Info } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

const NAV_ITEMS = [
  { path: '/', icon: Camera, label: 'Camera' },
  { path: '/map', icon: MapPin, label: 'Map' },
  { path: '/gallery', icon: Image, label: 'Gallery' },
  { path: '/player', icon: Play, label: 'Player' },
  { path: '/studio', icon: Film, label: 'Studio' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/about', icon: Info, label: 'About' },
] as const;

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="flex bg-sidebar border-t border-sidebar-border shrink-0">
      {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px]',
              'text-[9px] font-semibold transition-colors cursor-pointer',
              active
                ? 'text-primary'
                : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80'
            )}
          >
            <Icon size={18} strokeWidth={active ? 2.5 : 2} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
