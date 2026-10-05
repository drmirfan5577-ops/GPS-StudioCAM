import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Download,
  Play as PlayIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { loadAllMedia } from '@/lib/media-store.ts';
import type { CapturedMedia } from '@/lib/gps-utils.ts';
import { downloadBlob } from '@/lib/gps-utils.ts';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty.tsx';

const PLAYER_FILTERS = [
  { label: 'Original', value: '' },
  { label: 'Vivid', value: 'contrast(1.2) saturate(1.4)' },
  { label: 'Cool', value: 'hue-rotate(20deg) saturate(1.2)' },
  { label: 'Warm', value: 'sepia(0.4) saturate(1.3)' },
  { label: 'B&W', value: 'grayscale(1)' },
  { label: 'Fade', value: 'opacity(0.8) contrast(0.9) brightness(1.1)' },
];

export default function PlayerPage() {
  const [items, setItems] = useState<CapturedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [filterIndex, setFilterIndex] = useState(0);
  const [objectUrls, setObjectUrls] = useState<Map<string, string>>(new Map());

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadAllMedia().then((all) => {
      setItems(all);
      const urls = new Map<string, string>();
      all.forEach((item) => urls.set(item.id, URL.createObjectURL(item.blob)));
      setObjectUrls(urls);
      setLoading(false);
    });
    return () => {
      setObjectUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return new Map();
      });
    };
  }, []);

  const current = items[currentIndex];
  const currentUrl = current ? objectUrls.get(current.id) : undefined;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  const fmt = (secs: number) =>
    `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Main viewer */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {loading ? (
          <Skeleton className="w-full h-full" />
        ) : !current ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PlayIcon />
              </EmptyMedia>
              <EmptyTitle>No media</EmptyTitle>
              <EmptyDescription>Capture photos/videos in Camera mode</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : current.type === 'photo' && currentUrl ? (
          <img
            src={currentUrl}
            alt=""
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom})`,
              filter: PLAYER_FILTERS[filterIndex].value,
            }}
          />
        ) : currentUrl ? (
          <video
            ref={videoRef}
            src={currentUrl}
            className="max-w-full max-h-full"
            muted={muted}
            onTimeUpdate={() => {
              if (videoRef.current)
                setProgress(videoRef.current.currentTime / (videoRef.current.duration || 1));
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) setDuration(videoRef.current.duration);
            }}
            onEnded={() => setPlaying(false)}
            style={{ filter: PLAYER_FILTERS[filterIndex].value }}
          />
        ) : null}

        {/* Zoom controls */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
            className="bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
            className="bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
          >
            <ZoomOut size={14} />
          </button>
        </div>
      </div>

      {/* Controls */}
      {current && (
        <div className="bg-gray-950 px-4 py-3 shrink-0 space-y-2">
          {/* Info */}
          <div className="text-[10px] text-white/50 truncate">
            {current.flag} {current.locationName ?? 'Unknown Location'} ·{' '}
            {new Date(current.timestamp).toLocaleString('en-GB')}
          </div>

          {/* Progress bar (video only) */}
          {current.type === 'video' && (
            <div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={progress}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (videoRef.current && isFinite(duration) && duration > 0) videoRef.current.currentTime = v * duration;
                  setProgress(v);
                }}
                className="w-full h-1 accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-white/40 mt-0.5">
                <span>{fmt(progress * duration)}</span>
                <span>{fmt(duration)}</span>
              </div>
            </div>
          )}

          {/* Transport */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="text-white/60 cursor-pointer"
              >
                <SkipBack size={20} />
              </button>
              {current.type === 'video' && (
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white cursor-pointer"
                >
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
              )}
              <button
                onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
                className="text-white/60 cursor-pointer"
              >
                <SkipForward size={20} />
              </button>
              {current.type === 'video' && (
                <button onClick={() => setMuted((m) => !m)} className="text-white/60 cursor-pointer">
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
            </div>
            <button
              onClick={() =>
                downloadBlob(
                  current.blob,
                  `es-gps-${Date.now()}.${current.type === 'photo' ? 'jpg' : 'webm'}`
                )
              }
              className="text-white/60 cursor-pointer"
            >
              <Download size={18} />
            </button>
          </div>

          {/* Quick filters */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {PLAYER_FILTERS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => setFilterIndex(i)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer',
                  i === filterIndex ? 'bg-primary text-white' : 'bg-white/10 text-white/60'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Thumbnail strip */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {items.map((item, i) => {
              const url = objectUrls.get(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setCurrentIndex(i);
                    setZoom(1);
                    setFilterIndex(0);
                    setProgress(0);
                    setPlaying(false);
                  }}
                  className={cn(
                    'shrink-0 w-10 h-14 rounded overflow-hidden cursor-pointer border-2 transition-all',
                    i === currentIndex ? 'border-primary' : 'border-transparent opacity-60'
                  )}
                >
                  {item.type === 'photo' && url ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-[7px] text-red-400 font-bold">
                      VID
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
