export type CapturedMedia = {
  id: string;
  type: 'photo' | 'video';
  blob: Blob;
  mimeType: string;
  timestamp: string;
  lat?: number;
  lon?: number;
  altitude?: number | null;
  accuracy?: number;
  locationName?: string;
  flag?: string;
  plusCode?: string;
};

export function formatCoord(val: number, pos: string, neg: string): string {
  const dir = val >= 0 ? pos : neg;
  const abs = Math.abs(val);
  return `${abs.toFixed(6)}° ${dir}`;
}

export function formatDMS(val: number, pos: string, neg: string): string {
  const dir = val >= 0 ? pos : neg;
  const abs = Math.abs(val);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d) * 3600 - m * 60).toFixed(1);
  return `${d}° ${m}' ${s}" ${dir}`;
}

export function buildGPXContent(
  points: Array<{ lat: number; lon: number; alt?: number | null; ts: string }>
): string {
  const trackPoints = points
    .map(
      (p) =>
        `    <trkpt lat="${p.lat}" lon="${p.lon}">${
          p.alt != null ? `\n      <ele>${p.alt.toFixed(1)}</ele>` : ''
        }
      <time>${p.ts}</time>
    </trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ES GPS CAM - ES OneWorld">
  <trk>
    <name>ES GPS CAM Track ${new Date().toISOString()}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
