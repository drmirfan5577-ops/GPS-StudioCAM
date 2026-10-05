import { useState, useRef, useEffect } from 'react';
import { Download, Type, RotateCw, FlipHorizontal, Loader2, Film } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { loadAllMedia } from '@/lib/media-store.ts';
import type { CapturedMedia } from '@/lib/gps-utils.ts';
import { downloadBlob } from '@/lib/gps-utils.ts';
import { Slider } from '@/components/ui/slider.tsx';
import { toast } from 'sonner';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty.tsx';

const FILTERS = [
  { label: 'Original', value: '' },
  { label: 'Vivid', value: 'contrast(1.2) saturate(1.5) brightness(1.05)' },
  { label: 'Cinema', value: 'contrast(1.3) saturate(0.8) brightness(0.9) sepia(0.15)' },
  { label: 'Retro', value: 'sepia(0.5) contrast(1.1) brightness(0.95)' },
  { label: 'Noir', value: 'grayscale(1) contrast(1.3) brightness(0.9)' },
  { label: 'Neon', value: 'saturate(2) contrast(1.2) brightness(1.1)' },
  { label: 'Haze', value: 'brightness(1.15) contrast(0.85) saturate(0.9)' },
  { label: 'Velvia', value: 'saturate(1.8) contrast(1.1)' },
  { label: 'Warm', value: 'sepia(0.35) saturate(1.4) brightness(1.05)' },
  { label: 'Cool', value: 'hue-rotate(200deg) saturate(1.2) brightness(1.05)' },
  { label: 'Drama', value: 'contrast(1.5) brightness(0.85) saturate(1.3)' },
  { label: 'Soft', value: 'brightness(1.08) contrast(0.92) saturate(1.15)' },
];

export default function StudioPage() {
  const [items, setItems] = useState<CapturedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterIndex, setFilterIndex] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [textOverlay, setTextOverlay] = useState('');
  const [exporting, setExporting] = useState(false);
  const [objectUrls, setObjectUrls] = useState<Map<string, string>>(new Map());
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadAllMedia().then((all) => {
      const photos = all.filter((i) => i.type === 'photo');
      setItems(photos);
      const urls = new Map<string, string>();
      photos.forEach((item) => urls.set(item.id, URL.createObjectURL(item.blob)));
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

  const buildFilter = () => {
    const base = FILTERS[filterIndex].value;
    const adj = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    return base ? `${base} ${adj}` : adj;
  };

  const exportPhoto = async () => {
    if (!current || !currentUrl) return;
    setExporting(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = currentUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = buildFilter();
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (rotation) ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2);
      ctx.restore();
      ctx.filter = 'none';
      if (textOverlay) {
        const scale = canvas.height / 1080;
        ctx.font = `bold ${Math.round(48 * scale)}px Inter, Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = Math.round(4 * scale);
        ctx.strokeText(textOverlay, Math.round(20 * scale), canvas.height - Math.round(60 * scale));
        ctx.fillText(textOverlay, Math.round(20 * scale), canvas.height - Math.round(60 * scale));
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.97)
      );
      if (blob) {
        downloadBlob(blob, `es-studio-${Date.now()}.jpg`);
        toast.success('Photo exported!');
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="font-bold text-sm flex items-center gap-2">
          <Film size={16} className="text-primary" />
          Studio
        </div>
        <button
          onClick={exportPhoto}
          disabled={!current || exporting}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Film />
              </EmptyMedia>
              <EmptyTitle>No photos</EmptyTitle>
              <EmptyDescription>Take photos in Camera mode to edit here</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div>
            {/* Preview canvas */}
            <div className="bg-black aspect-[4/3] relative overflow-hidden flex items-center justify-center">
              {currentUrl && (
                <img
                  ref={imgRef}
                  src={currentUrl}
                  alt="Edit preview"
                  className="max-w-full max-h-full object-contain transition-all duration-200"
                  style={{
                    filter: buildFilter(),
                    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                  }}
                />
              )}
            </div>

            {/* Thumbnail strip */}
            <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-border scrollbar-hide">
              {items.map((item, i) => {
                const url = objectUrls.get(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setCurrentIndex(i);
                      setFilterIndex(0);
                      setBrightness(100);
                      setContrast(100);
                      setSaturation(100);
                      setRotation(0);
                      setFlipH(false);
                    }}
                    className={cn(
                      'shrink-0 w-12 h-16 rounded overflow-hidden cursor-pointer border-2 transition-all',
                      i === currentIndex ? 'border-primary' : 'border-transparent opacity-60'
                    )}
                  >
                    {url && <img src={url} alt="" className="w-full h-full object-cover" />}
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div className="px-3 py-2.5 border-b border-border">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Filters
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {FILTERS.map((f, i) => (
                  <button
                    key={f.label}
                    onClick={() => setFilterIndex(i)}
                    className={cn(
                      'shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors',
                      i === filterIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Adjustments */}
            <div className="px-3 py-2.5 border-b border-border space-y-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Adjustments
              </div>
              {(
                [
                  { label: 'Brightness', value: brightness, set: setBrightness },
                  { label: 'Contrast', value: contrast, set: setContrast },
                  { label: 'Saturation', value: saturation, set: setSaturation },
                ] as const
              ).map(({ label, value, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0">
                    {label} {value}%
                  </span>
                  <Slider
                    value={[value]}
                    onValueChange={([v]) => set(v)}
                    min={50}
                    max={150}
                    step={1}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>

            {/* Transform */}
            <div className="flex gap-2 px-3 py-2.5 border-b border-border">
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
              >
                <RotateCw size={12} />
                Rotate 90°
              </button>
              <button
                onClick={() => setFlipH((f) => !f)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer',
                  flipH
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <FlipHorizontal size={12} />
                Flip H
              </button>
            </div>

            {/* Text overlay */}
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                <Type size={10} />
                Text Overlay
              </div>
              <input
                value={textOverlay}
                onChange={(e) => setTextOverlay(e.target.value)}
                placeholder="Add text to your photo…"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
