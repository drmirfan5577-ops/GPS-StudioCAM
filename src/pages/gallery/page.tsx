import { useState, useEffect, useCallback } from 'react';
import { Trash2, Download, X, Image, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { loadAllMedia, deleteMediaItem, clearAllMedia } from '@/lib/media-store.ts';
import type { CapturedMedia } from '@/lib/gps-utils.ts';
import { downloadBlob } from '@/lib/gps-utils.ts';
import { toast } from 'sonner';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty.tsx';

type FilterType = 'all' | 'photo' | 'video';

export default function GalleryPage() {
  const [items, setItems] = useState<CapturedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [lightbox, setLightbox] = useState<CapturedMedia | null>(null);
  const [objectUrls, setObjectUrls] = useState<Map<string, string>>(new Map());

  const loadItems = useCallback(async () => {
    setLoading(true);
    const all = await loadAllMedia();
    setItems(all);
    const urls = new Map<string, string>();
    all.forEach((item) => {
      urls.set(item.id, URL.createObjectURL(item.blob));
    });
    setObjectUrls((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
    return () => {
      setObjectUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return new Map();
      });
    };
  }, [loadItems]);

  const filtered = items.filter((i) => filter === 'all' || i.type === filter);

  const handleDelete = async (item: CapturedMedia) => {
    await deleteMediaItem(item.id);
    toast.success('Deleted');
    setLightbox(null);
    loadItems();
  };

  const handleClearAll = async () => {
    if (!confirm('Delete all captured media?')) return;
    await clearAllMedia();
    toast.success('Gallery cleared');
    loadItems();
  };

  const handleDownload = (item: CapturedMedia) => {
    const ext = item.type === 'photo' ? 'jpg' : 'webm';
    downloadBlob(item.blob, `es-gps-cam-${Date.now()}.${ext}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div>
          <div className="font-bold text-sm">Gallery</div>
          <div className="text-[10px] text-muted-foreground">
            {items.length} items · Auto-saved (IndexedDB)
          </div>
        </div>
        <button
          onClick={handleClearAll}
          className="text-xs text-destructive font-semibold cursor-pointer"
        >
          Clear All
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-border shrink-0">
        {(['all', 'photo', 'video'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {f === 'all' ? (
              'All'
            ) : f === 'photo' ? (
              <>
                <Image size={10} />
                Photos
              </>
            ) : (
              <>
                <Video size={10} />
                Videos
              </>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Image />
              </EmptyMedia>
              <EmptyTitle>No media yet</EmptyTitle>
              <EmptyDescription>Take photos or videos in Camera mode</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-3 gap-1 p-1">
            {filtered.map((item) => {
              const url = objectUrls.get(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => setLightbox(item)}
                  className="aspect-[9/16] bg-muted rounded-lg overflow-hidden cursor-pointer relative"
                >
                  {item.type === 'photo' && url ? (
                    <img
                      src={url}
                      alt={item.locationName ?? 'Photo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-red-400 gap-1">
                      <Video size={22} />
                      <span className="text-[8px] font-bold">VIDEO</span>
                    </div>
                  )}
                  {item.flag && (
                    <span className="absolute top-1 left-1 text-sm">{item.flag}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/96 flex flex-col items-center justify-center p-4">
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 bg-white/10 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer"
          >
            <X size={18} className="text-white" />
          </button>
          {lightbox.type === 'photo' && objectUrls.get(lightbox.id) ? (
            <img
              src={objectUrls.get(lightbox.id)}
              alt="Preview"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          ) : (
            <video
              src={objectUrls.get(lightbox.id)}
              controls
              className="max-w-full max-h-[70vh] rounded-lg"
            />
          )}
          {lightbox.locationName && (
            <div className="mt-3 text-center text-sm text-white/80">
              {lightbox.flag} {lightbox.locationName}
            </div>
          )}
          {lightbox.lat != null && lightbox.lon != null && (
            <div className="text-[10px] font-mono text-white/50 mt-1">
              Lat {lightbox.lat.toFixed(6)}°&nbsp;&nbsp;Long {lightbox.lon.toFixed(6)}°
            </div>
          )}
          <div className="text-[10px] text-white/40 mt-0.5">
            {new Date(lightbox.timestamp).toLocaleString('en-GB')}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleDownload(lightbox)}
              className="flex items-center gap-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              <Download size={14} />
              Save
            </button>
            <button
              onClick={() => handleDelete(lightbox)}
              className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
