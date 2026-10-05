import { useEffect, useRef, useState } from 'react';
import { Satellite, Map as MapIcon, Download, Circle } from 'lucide-react';
import { useGPS } from '@/hooks/use-gps.ts';
import { buildGPXContent, downloadBlob } from '@/lib/gps-utils.ts';
import { reverseGeocode, type ReverseGeocodeResult } from '@/lib/stamp-engine.ts';
import { cn } from '@/lib/utils.ts';
import { toast } from 'sonner';

type TrackPoint = { lat: number; lon: number; alt?: number | null; ts: string };
type MapStyle = 'street' | 'satellite';

export default function MapPage() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polyRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileRef = useRef<any>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('street');
  const [tracking, setTracking] = useState(false);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [geocode, setGeocode] = useState<ReverseGeocodeResult | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { position } = useGPS(true);

  useEffect(() => {
    const init = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (!mapDivRef.current || mapRef.current) return;

      const map = L.map(mapDivRef.current, { zoomControl: true, attributionControl: true });
      mapRef.current = map;

      const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      });
      tile.addTo(map);
      tileRef.current = tile;

      const icon = L.divIcon({
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#0ea5e9;border:3px solid white;box-shadow:0 0 8px rgba(14,165,233,0.8)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: '',
      });
      const marker = L.marker([0, 0], { icon });
      markerRef.current = marker;
      const poly = L.polyline([], { color: '#0ea5e9', weight: 3, opacity: 0.8 });
      polyRef.current = poly;
      poly.addTo(map);
      map.setView([30, 70], 5);
      setMapReady(true);
    };
    init();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    const update = async () => {
      const L = (await import('leaflet')).default;
      tileRef.current.remove();
      const url =
        mapStyle === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attr =
        mapStyle === 'satellite' ? '© Esri' : '© OpenStreetMap contributors';
      tileRef.current = L.tileLayer(url, { attribution: attr, maxZoom: 19 });
      tileRef.current.addTo(mapRef.current);
    };
    update();
  }, [mapStyle]);

  useEffect(() => {
    if (!position || !mapRef.current || !mapReady) return;
    const { latitude: lat, longitude: lon, altitude: alt } = position;
    const update = async () => {
      const L = (await import('leaflet')).default;
      if (!markerRef.current._map) markerRef.current.addTo(mapRef.current);
      markerRef.current.setLatLng([lat, lon]);
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.setView([lat, lon], currentZoom < 14 ? 16 : currentZoom);
      if (tracking) {
        const pt: TrackPoint = { lat, lon, alt, ts: new Date().toISOString() };
        setTrackPoints((prev) => {
          const next = [...prev, pt];
          polyRef.current?.setLatLngs(
            next.map((p) => [p.lat, p.lon] as L.LatLngExpression)
          );
          return next;
        });
      }
    };
    update();
    reverseGeocode(lat, lon).then((geo) => {
      if (geo) setGeocode(geo);
    });
  }, [position, tracking, mapReady]);

  const exportGPX = () => {
    if (trackPoints.length < 2) {
      toast.error('Record at least 2 points first');
      return;
    }
    const content = buildGPXContent(trackPoints);
    downloadBlob(
      new Blob([content], { type: 'application/gpx+xml' }),
      `es-gps-track-${Date.now()}.gpx`
    );
    toast.success('GPX exported');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div ref={mapDivRef} className="flex-1" />
      <div className="bg-card border-t border-border px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            {position ? (
              <div className="font-mono text-[11px] text-primary truncate">
                Lat {position.latitude.toFixed(6)}°&nbsp;&nbsp;Long {position.longitude.toFixed(6)}°
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Acquiring GPS signal…</div>
            )}
            {geocode && (
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {geocode.flag} {geocode.locationName}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setMapStyle((s) => (s === 'street' ? 'satellite' : 'street'))}
              className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1.5 text-[11px] font-semibold cursor-pointer"
            >
              {mapStyle === 'street' ? <Satellite size={12} /> : <MapIcon size={12} />}
              {mapStyle === 'street' ? 'Satellite' : 'Street'}
            </button>
            <button
              onClick={() => {
                setTracking((t) => !t);
                if (!tracking) setTrackPoints([]);
              }}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold cursor-pointer',
                tracking
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-muted'
              )}
            >
              <Circle size={10} className={tracking ? 'fill-red-400 text-red-400' : ''} />
              {tracking ? 'Stop' : 'Track'}
            </button>
            {trackPoints.length > 1 && (
              <button
                onClick={exportGPX}
                className="flex items-center gap-1 bg-primary/20 text-primary border border-primary/30 rounded-lg px-2 py-1.5 text-[11px] font-semibold cursor-pointer"
              >
                <Download size={12} />
                GPX
              </button>
            )}
          </div>
        </div>
        {tracking && (
          <div className="text-[10px] text-muted-foreground">
            {trackPoints.length} track points recorded
          </div>
        )}
      </div>
    </div>
  );
}
