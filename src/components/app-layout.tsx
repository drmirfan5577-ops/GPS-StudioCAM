import { Outlet } from 'react-router-dom';
import AppHeader from './app-header.tsx';
import BottomNav from './bottom-nav.tsx';

export default function AppLayout() {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
