import { useState, useRef, useEffect, useCallback } from 'react';
import { SwitchCamera } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { useGPS } from '@/hooks/use-gps.ts';
import { useCameraAdvanced, CAMERA_RESOLUTIONS } from '@/hooks/use-camera-advanced.ts';
import { saveMediaItem } from '@/lib/media-store.ts';
import {
  drawStamp,
  loadMapThumb,
  reverseGeocode,
  DEFAULT_STAMP_OPTIONS,
  type StampOptions,
  type ReverseGeocodeResult,
} from '@/lib/stamp-engine.ts';
import { toast } from 'sonner';

type CaptureMode = 'photo' | 'video';

const AR_OPTIONS: Array<{ label: string; ratio: [number, number] }> = [
  { label: '9:16', ratio: [9, 16] },
  { label: '16:9', ratio: [16, 9] },
  { label: '1:1', ratio: [1, 1] },
  { label: '4:3', ratio: [4, 3] },
  { label: '3:4', ratio: [3, 4] },
  { label: '2:3', ratio: [2, 3] },
];

const BEAUTY_FILTERS = [
  { label: '✨ Beauty Off', value: '' },
  { label: 'Soft', value: 'brightness(1.05) contrast(0.95) saturate(1.1)' },
  { label: 'Vivid', value: 'contrast(1.15) saturate(1.4) brightness(1.05)' },
  { label: 'Cinema', value: 'contrast(1.2) saturate(0.85) brightness(0.95) sepia(0.1)' },
  { label: 'Warm', value: 'sepia(0.3) saturate(1.3) brightness(1.05)' },
  { label: 'Cool', value: 'hue-rotate(20deg) saturate(1.2) brightness(1.02)' },
  { label: 'B&W', value: 'grayscale(1) contrast(1.1)' },
];

type ToggleProps = { on: boolean; onClick: () => void; label: string };

function Toggle({ on, onClick, label }: ToggleProps) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 cursor-pointer select-none">
      <div
        className={cn(
          'w-7 rounded-full relative transition-colors',
          on ? 'bg-primary' : 'bg-gray-600'
        )}
        style={{ height: '16px' }}
      >
        <div
          className={cn(
            'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
            on ? 'translate-x-3.5' : 'translate-x-0.5'
          )}
        />
      </div>
      <span className="text-[10px] text-white/60 font-medium whitespace-nowrap">{label}</span>
    </button>
  );
}

export default function CameraPage() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const [arIndex, setArIndex] = useState(0);
  const [resIndex, setResIndex] = useState(0);
  const [beautyIndex, setBeautyIndex] = useState(0);
  const [stampOptions, setStampOptions] = useState<StampOptions>(DEFAULT_STAMP_OPTIONS);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerCount, setTimerCount] = useState<number | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [geocode, setGeocode] = useState<ReverseGeocodeResult | null>(null);
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  const animRef = useRef<number>(0);
  const recIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geocodeRef = useRef<ReverseGeocodeResult | null>(null);
  const mapThumbRef = useRef<HTMLCanvasElement | null>(null);

  const { position } = useGPS(gpsEnabled && cameraStarted);
  const camera = useCameraAdvanced();

  // Keep geocodeRef in sync
  useEffect(() => {
    geocodeRef.current = geocode;
  }, [geocode]);

  // Reverse geocode when position changes significantly
  const posKey = position ? `${position.latitude.toFixed(3)},${position.longitude.toFixed(3)}` : null;
  useEffect(() => {
    if (!position) return;
    reverseGeocode(position.latitude, position.longitude).then((geo) => {
      if (geo) {
        setGeocode(geo);
        geocodeRef.current = geo;
      }
    });
    // Preload the map tile used by the live preview stamp
    loadMapThumb(position.latitude, position.longitude).then((thumb) => {
      mapThumbRef.current = thumb;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey]);

  const handleStart = useCallback(async () => {
    const res = CAMERA_RESOLUTIONS[resIndex];
    await camera.startCamera('environment', res);
    setCameraStarted(true);
  }, [camera, resIndex]);

  // Live stamp loop
  useEffect(() => {
    if (!cameraStarted) return;
    const draw = () => {
      const v = camera.videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || !v.videoWidth) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      // Match the on-screen size so the stamp isn't stretched by the video's crop
      if (c.width !== c.clientWidth || c.height !== c.clientHeight) {
        c.width = c.clientWidth;
        c.height = c.clientHeight;
      }
      const ctx = c.getContext('2d');
      if (!ctx) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, c.width, c.height);
      if (stampOptions.showStamp && position) {
        drawStamp(ctx, c.width, c.height, {
          lat: position.latitude,
          lon: position.longitude,
          date: new Date(),
          geo: geocodeRef.current,
          mapThumb: mapThumbRef.current,
          options: stampOptions,
        });
      }
      if (timerCount !== null) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.font = `bold ${Math.round(c.height * 0.22)}px Arial`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(String(timerCount), c.width / 2, c.height / 2 + c.height * 0.09);
        ctx.textAlign = 'left';
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [cameraStarted, stampOptions, position, timerCount]);

  const doCapture = useCallback(async () => {
    if (captureMode === 'photo') {
      const currentPos = position;
      const currentGeo = geocodeRef.current;
      const blob = await camera.capturePhoto(
        BEAUTY_FILTERS[beautyIndex].value,
        AR_OPTIONS[arIndex].ratio,
        async (ctx, w, h) => {
          if (stampOptions.showStamp && currentPos) {
            const mapThumb = stampOptions.showMapThumb
              ? await loadMapThumb(currentPos.latitude, currentPos.longitude)
              : null;
            drawStamp(ctx, w, h, {
              lat: currentPos.latitude,
              lon: currentPos.longitude,
              date: new Date(),
              geo: currentGeo,
              mapThumb,
              options: stampOptions,
            });
          }
        }
      );
      if (!blob) {
        toast.error('Capture failed');
        return;
      }
      const url = URL.createObjectURL(blob);
      setLastThumb(url);
      await saveMediaItem({
        id: `photo_${Date.now()}`,
        type: 'photo',
        blob,
        mimeType: 'image/jpeg',
        timestamp: new Date().toISOString(),
        lat: position?.latitude,
        lon: position?.longitude,
        altitude: position?.altitude,
        accuracy: position?.accuracy,
        locationName: geocodeRef.current?.locationName,
        flag: geocodeRef.current?.flag,
      });
      toast.success('📸 Photo saved to Gallery');
    } else {
      if (!camera.isRecording) {
        // Returns an error message, or null on success
        const startError = await camera.startVideoRecording();
        if (startError) {
          toast.error(startError);
          return;
        }
        setRecSeconds(0);
        recIntervalRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
        toast('🔴 Recording started');
      } else {
        if (recIntervalRef.current) clearInterval(recIntervalRef.current);
        const blob = await camera.stopVideoRecording();
        if (!blob) {
          toast.error('Recording failed');
          return;
        }
        await saveMediaItem({
          id: `video_${Date.now()}`,
          type: 'video',
          blob,
          mimeType: blob.type || 'video/webm',
          timestamp: new Date().toISOString(),
          lat: position?.latitude,
          lon: position?.longitude,
          locationName: geocodeRef.current?.locationName,
          flag: geocodeRef.current?.flag,
        });
        toast.success(`🎬 Video saved (${recSeconds}s)`);
      }
    }
  }, [captureMode, camera, beautyIndex, arIndex, stampOptions, position, recSeconds]);

  const handleShutter = useCallback(() => {
    if (timerEnabled && captureMode === 'photo' && timerCount === null) {
      let count = 5;
      setTimerCount(count);
      const tick = () => {
        count--;
        if (count <= 0) {
          setTimerCount(null);
          doCapture();
          return;
        }
        setTimerCount(count);
        timerRef.current = setTimeout(tick, 1000);
      };
      timerRef.current = setTimeout(tick, 1000);
    } else {
      doCapture();
    }
  }, [timerEnabled, captureMode, timerCount, doCapture]);

  const toggleOption = (key: keyof StampOptions) =>
    setStampOptions((p) => ({ ...p, [key]: !p[key] }));

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Viewfinder */}
      <div className="relative flex-1 bg-black overflow-hidden">
        {!cameraStarted ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-5xl mb-4">📍</div>
            <h1 className="text-xl font-black text-white mb-1">ES GPS CAM</h1>
            <p className="text-xs text-white/50 mb-1">A project of ES OneWorld</p>
            <p className="text-xs text-white/40 mb-6 leading-relaxed">
              Professional GPS location camera
              <br />
              Camera &amp; GPS permissions required
            </p>
            <button
              onClick={handleStart}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold text-sm cursor-pointer"
            >
              📷 Launch Camera
            </button>
          </div>
        ) : (
          <>
            <video
              ref={camera.attachVideo}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ filter: BEAUTY_FILTERS[beautyIndex].value || 'none' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            {/* Corner guides */}
            {[
              'top-2.5 left-2.5 border-t-2 border-l-2',
              'top-2.5 right-2.5 border-t-2 border-r-2',
              'bottom-2.5 left-2.5 border-b-2 border-l-2',
              'bottom-2.5 right-2.5 border-b-2 border-r-2',
            ].map((c, i) => (
              <div key={i} className={cn('absolute w-6 h-6 border-white/40', c)} />
            ))}
            {/* GPS badge */}
            {gpsEnabled && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/65 border border-white/15 rounded-full px-2.5 py-1 backdrop-blur-sm">
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    position ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'
                  )}
                />
                <span className="text-[9px] text-white font-semibold">
                  {position ? 'GPS Fixed' : 'Acquiring…'}
                </span>
              </div>
            )}
            {/* REC badge */}
            {camera.isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/20 border border-red-500 rounded-full px-2.5 py-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400 font-bold">{fmt(recSeconds)}</span>
              </div>
            )}
            {/* Last capture thumbnail */}
            {lastThumb && (
              <img
                src={lastThumb}
                alt="last"
                className="absolute bottom-3 right-3 w-11 h-16 object-cover rounded border-2 border-white shadow-lg"
              />
            )}
          </>
        )}
      </div>

      {/* Controls (only shown after camera started) */}
      {cameraStarted && (
        <div className="bg-gray-950 px-3 pt-2 pb-2 shrink-0 space-y-2">
          {/* Row 1: Selectors */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            <select
              value={arIndex}
              onChange={(e) => setArIndex(Number(e.target.value))}
              className="bg-gray-800 border border-white/10 text-white/80 rounded-lg px-2 py-1.5 text-[11px] font-semibold cursor-pointer shrink-0"
            >
              {AR_OPTIONS.map((a, i) => (
                <option key={a.label} value={i}>
                  {a.label}
                </option>
              ))}
            </select>
            <select
              value={resIndex}
              onChange={(e) => {
                const i = Number(e.target.value);
                setResIndex(i);
                camera.startCamera(camera.facing, CAMERA_RESOLUTIONS[i]);
              }}
              className="bg-gray-800 border border-white/10 text-white/80 rounded-lg px-2 py-1.5 text-[11px] font-semibold cursor-pointer shrink-0"
            >
              {CAMERA_RESOLUTIONS.map((r, i) => (
                <option key={r.label} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={beautyIndex}
              onChange={(e) => setBeautyIndex(Number(e.target.value))}
              className="bg-gray-800 border border-white/10 text-white/80 rounded-lg px-2 py-1.5 text-[11px] font-semibold cursor-pointer shrink-0"
            >
              {BEAUTY_FILTERS.map((f, i) => (
                <option key={f.label} value={i}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Toggles */}
          <div className="flex gap-3 flex-wrap">
            <Toggle
              on={stampOptions.showStamp}
              onClick={() => toggleOption('showStamp')}
              label="📍 Stamp"
            />
            <Toggle on={gpsEnabled} onClick={() => setGpsEnabled((v) => !v)} label="🛰 GPS" />
            <Toggle
              on={timerEnabled}
              onClick={() => setTimerEnabled((v) => !v)}
              label="⏱ 5s Timer"
            />
            <Toggle
              on={stampOptions.showMapThumb}
              onClick={() => toggleOption('showMapThumb')}
              label="🗺 Map"
            />
            <Toggle
              on={stampOptions.showPlusCode}
              onClick={() => toggleOption('showPlusCode')}
              label="＋Code"
            />
          </div>

          {/* Row 3: Capture controls */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              <button
                onClick={() => setCaptureMode('photo')}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer',
                  captureMode === 'photo'
                    ? 'bg-primary text-white'
                    : 'bg-gray-800 text-white/60'
                )}
              >
                Photo
              </button>
              <button
                onClick={() => setCaptureMode('video')}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer',
                  captureMode === 'video'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-white/60'
                )}
              >
                Video
              </button>
            </div>

            {/* Shutter button */}
            <button
              onClick={handleShutter}
              className={cn(
                'w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all cursor-pointer shrink-0',
                captureMode === 'video'
                  ? camera.isRecording
                    ? 'border-red-500 bg-red-500'
                    : 'border-red-500 bg-red-500/15'
                  : 'border-white bg-white/15'
              )}
            >
              <div
                className={cn(
                  'transition-all',
                  captureMode === 'video'
                    ? camera.isRecording
                      ? 'w-6 h-6 rounded-sm bg-white'
                      : 'w-7 h-7 rounded-full bg-red-500'
                    : 'w-12 h-12 rounded-full bg-white'
                )}
              />
            </button>

            <button
              onClick={() => camera.flipCamera(CAMERA_RESOLUTIONS[resIndex])}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white cursor-pointer"
            >
              <SwitchCamera size={18} />
            </button>
          </div>

          {/* GPS strip */}
          {position && gpsEnabled && (
            <div className="font-mono text-[9px] text-cyan-400 bg-white/5 rounded-lg px-2.5 py-1.5">
              {geocode?.flag}{' '}
              {geocode?.locationName ? `${geocode.locationName} · ` : ''}
              Lat {position.latitude.toFixed(6)}° Long {position.longitude.toFixed(6)}°
              {position.altitude != null ? ` · Alt ${position.altitude.toFixed(1)}m` : ''}
              {` · ±${position.accuracy.toFixed(0)}m`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
