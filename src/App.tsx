import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DefaultProviders } from './components/providers/default.tsx';
import AuthCallback from './pages/auth/Callback.tsx';
import AppLayout from './components/app-layout.tsx';
import CameraPage from './pages/camera/page.tsx';
import MapPage from './pages/map/page.tsx';
import GalleryPage from './pages/gallery/page.tsx';
import PlayerPage from './pages/player/page.tsx';
import StudioPage from './pages/studio/page.tsx';
import SettingsPage from './pages/settings/page.tsx';
import AboutPage from './pages/about/page.tsx';
import NotFound from './pages/NotFound.tsx';
import { useServiceWorker } from './hooks/use-service-worker.ts';

function AppRoutes() {
  useServiceWorker();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<CameraPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <DefaultProviders>
      <AppRoutes />
    </DefaultProviders>
  );
}
