import { encode as encodePlusCode } from 'open-location-code';

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:3' | '3:4' | '2:3';

export type ReverseGeocodeResult = {
  locationName: string; // "Sarai Sidhu, Punjab, Pakistan"
  address: string; // "Government Hospital Sarai Sidhu, Near Tehsil Kabirwala, Sarai Sidhu, Punjab 58250, Pakistan"
  city: string;
  state: string;
  country: string;
  flag: string;
  countryCode: string;
};

export type StampOptions = {
  showStamp: boolean;
  showMapThumb: boolean;
  showPlusCode: boolean;
  showAltitude: boolean;
  showAccuracy: boolean;
};

export const DEFAULT_STAMP_OPTIONS: StampOptions = {
  showStamp: true,
  showMapThumb: true,
  showPlusCode: true,
  showAltitude: true,
  showAccuracy: true,
};

export type StampData = {
  lat: number;
  lon: number;
  date: Date;
  geo: ReverseGeocodeResult | null;
  mapThumb: HTMLCanvasElement | null;
  options: StampOptions;
};

const FONT = '"Roboto", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const BRAND = 'ES GPS CAM';

// ─── Formatting ───────────────────────────────────────────────────────────────
function gmtOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const m = String(Math.abs(offset) % 60).padStart(2, '0');
  return `GMT ${sign}${h}:${m}`;
}

// "Wednesday, 23/09/2026 09:03 AM GMT +05:00"
export function formatStampDate(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const h24 = date.getHours();
  const h12 = String(h24 % 12 === 0 ? 12 : h24 % 12).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${weekday}, ${dd}/${mm}/${date.getFullYear()} ${h12}:${min} ${ampm} ${gmtOffset(date)}`;
}

// Short plus code like "HXR8+FC9" (area prefix dropped, as Google shows it)
export function shortPlusCode(lat: number, lon: number): string {
  try {
    return encodePlusCode(lat, lon, 10).slice(4);
  } catch {
    return '';
  }
}

// ─── Reverse geocoding ────────────────────────────────────────────────────────────
type NominatimAddress = Partial<
  Record<
    | 'amenity' | 'building' | 'shop' | 'office' | 'tourism' | 'road' | 'neighbourhood'
    | 'hamlet' | 'suburb' | 'village' | 'town' | 'city' | 'municipality' | 'county'
    | 'state_district' | 'state' | 'postcode' | 'country' | 'country_code',
    string
  >
>;

const geocodeCache = new Map<string, ReverseGeocodeResult>();

function flagFor(code: string): string {
  return code.length === 2
    ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
    : '';
}

function uniq(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return parts.filter((p): p is string => {
    if (!p) return false;
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=en`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; address?: NominatimAddress };
    const a = data.address ?? {};
    const city = a.village ?? a.town ?? a.city ?? a.municipality ?? a.suburb ?? a.hamlet ?? a.county ?? '';
    const state = a.state ?? '';
    const country = a.country ?? '';
    const countryCode = (a.country_code ?? '').toUpperCase();
    const place = data.name || a.amenity || a.building || a.shop || a.office || a.tourism;
    const near = a.county ?? a.state_district;

    const statePost = [state, a.postcode].filter(Boolean).join(' ');
    const address = uniq([
      place,
      a.road,
      a.neighbourhood,
      near && near !== city ? `Near ${near}` : undefined,
      city,
      statePost,
      country,
    ]).join(', ');

    const result: ReverseGeocodeResult = {
      locationName: uniq([city, state, country]).join(', '),
      address,
      city,
      state,
      country,
      flag: flagFor(countryCode),
      countryCode,
    };
    geocodeCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

// ─── Satellite map thumbnail, precisely centred on the coordinate ─────────────
const TILE = 256;
const MAP_ZOOM = 17;
const thumbCache = new Map<string, Promise<HTMLCanvasElement | null>>();

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  });
}

async function buildThumb(lat: number, lon: number): Promise<HTMLCanvasElement | null> {
  const n = 2 ** MAP_ZOOM;
  const latRad = (lat * Math.PI) / 180;
  const worldX = ((lon + 180) / 360) * n * TILE;
  const worldY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE;

  // 512px window centred on the point
  const size = 512;
  const left = worldX - size / 2;
  const top = worldY - size / 2;
  const tx0 = Math.floor(left / TILE);
  const ty0 = Math.floor(top / TILE);
  const tx1 = Math.floor((left + size) / TILE);
  const ty1 = Math.floor((top + size) / TILE);

  const jobs: Array<Promise<{ img: HTMLImageElement | null; x: number; y: number }>> = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const wrappedX = ((tx % n) + n) % n;
      jobs.push(loadTile(MAP_ZOOM, wrappedX, ty).then((img) => ({ img, x: tx, y: ty })));
    }
  }
  const tiles = await Promise.all(jobs);
  if (tiles.every((t) => !t.img)) return null;

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  for (const t of tiles) {
    if (t.img) ctx.drawImage(t.img, t.x * TILE - left, t.y * TILE - top, TILE, TILE);
  }
  return c;
}

export function loadMapThumb(lat: number, lon: number): Promise<HTMLCanvasElement | null> {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  let p = thumbCache.get(key);
  if (!p) {
    p = buildThumb(lat, lon);
    thumbCache.set(key, p);
    p.then((r) => {
      if (!r) thumbCache.delete(key); // allow retry when offline
    });
  }
  return p;
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────────
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      line = words.slice(i).join(' ');
      break;
    }
  }
  if (line) lines.push(line);
  // Ellipsize the final line if it still overflows
  const last = lines.length - 1;
  if (last >= 0 && ctx.measureText(lines[last]).width > maxW) {
    let t = lines[last];
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    lines[last] = `${t}…`;
  }
  return lines;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, tipY: number, r: number) {
  const cy = tipY - r * 1.9;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetY = r * 0.15;
  ctx.fillStyle = '#e8261c';
  ctx.beginPath();
  ctx.arc(x, cy, r, Math.PI * 0.82, Math.PI * 0.18);
  ctx.quadraticCurveTo(x + r * 0.35, tipY - r * 0.5, x, tipY);
  ctx.quadraticCurveTo(x - r * 0.35, tipY - r * 0.5, x - r * Math.cos(Math.PI * 0.18), cy + r * Math.sin(Math.PI * 0.18));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#8b0d06';
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
}

function drawMapPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
  thumb: HTMLCanvasElement | null
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.clip();
  if (thumb) {
    ctx.drawImage(thumb, x, y, size, size);
  } else {
    const g = ctx.createLinearGradient(x, y, x + size, y + size);
    g.addColorStop(0, '#5d6b4f');
    g.addColorStop(1, '#8a8f73');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, size, size);
  }
  // Pin sits exactly on the coordinate (centre of the thumbnail)
  drawPin(ctx, x + size / 2, y + size / 2, size * 0.07);

  // "Google" watermark, bottom-left
  const gFont = Math.round(size * 0.2);
  ctx.font = `500 ${gFont}px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = gFont * 0.12;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText('Google', x + size * 0.05, y + size * 0.92);
  ctx.fillText('Google', x + size * 0.05, y + size * 0.92);
  ctx.restore();
}

function drawBrandBadge(ctx: CanvasRenderingContext2D, right: number, bottom: number, u: number) {
  const fontPx = Math.round(24 * u);
  ctx.font = `500 ${fontPx}px ${FONT}`;
  const textW = ctx.measureText(BRAND).width;
  const iconR = 13 * u;
  const padX = 12 * u;
  const h = 40 * u;
  const w = padX + iconR * 2 + 10 * u + textW + padX;
  const x = right - w;
  const y = bottom - h;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8 * u);
  ctx.fill();

  // Round app icon with a small pin
  const icx = x + padX + iconR;
  const icy = y + h / 2;
  ctx.fillStyle = '#1a73e8';
  ctx.beginPath();
  ctx.arc(icx, icy, iconR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbc04';
  ctx.beginPath();
  ctx.arc(icx, icy - iconR * 0.15, iconR * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(BRAND, icx + iconR + 10 * u, icy + u);
  ctx.textBaseline = 'alphabetic';
}

// ─── Main stamp (matches the GPS Map Camera layout) ────────────────────────────────────────
// [ Map | City, State, Country 🇵🇰
//       | PLUS+CODE Full address…
//       | …address continued
//       | Lat 30.591006° Long 71.966081°
//       | Wednesday, 23/09/2026 09:03 AM GMT +05:00 ]
export function drawStamp(ctx: CanvasRenderingContext2D, W: number, H: number, d: StampData): void {
  if (!d.options.showStamp) return;

  // Design grid is 1100 units wide; limit height so it never covers too much of the frame
  const margin = Math.round(Math.min(W, H) * 0.02);
  const stampW = Math.min(W - margin * 2, H * 1.25);
  const u = stampW / 1100;
  const pad = 16 * u;
  const showMap = d.options.showMapThumb;
  const mapSize = showMap ? 236 * u : 0;
  const titlePx = 46 * u;
  const bodyPx = 29 * u;
  const bodyLH = 37 * u;

  ctx.save();
  ctx.textAlign = 'left';

  // Text column width
  const textX0 = showMap ? pad + mapSize + 22 * u : pad + 8 * u;
  const textW = stampW - textX0 - pad;

  // Build lines first so the panel height fits the content
  const geo = d.geo;
  const title = geo?.locationName || `${d.lat.toFixed(4)}°, ${d.lon.toFixed(4)}°`;
  const flag = geo?.flag ?? '';
  const plus = d.options.showPlusCode ? shortPlusCode(d.lat, d.lon) : '';
  const addressText = [plus, geo?.address].filter(Boolean).join(' ');

  ctx.font = `400 ${bodyPx}px ${FONT}`;
  const addrLines = addressText ? wrapLines(ctx, addressText, textW, 2) : [];
  const bodyLines = [
    ...addrLines,
    `Lat ${d.lat.toFixed(6)}° Long ${d.lon.toFixed(6)}°`,
    formatStampDate(d.date),
  ];

  const contentH = titlePx * 1.25 + bodyLines.length * bodyLH;
  const panelH = Math.max(showMap ? mapSize + pad * 2 : 0, contentH + pad * 2);
  const px = W - margin - stampW;
  const py = H - margin - panelH;

  // Brand badge above the panel, right-aligned
  drawBrandBadge(ctx, px + stampW, py - 8 * u, u);

  // Translucent dark panel
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(px, py, stampW, panelH, 14 * u);
  ctx.fill();

  if (showMap) {
    drawMapPanel(ctx, px + pad, py + (panelH - mapSize) / 2, mapSize, 10 * u, d.mapThumb);
  }

  const tx = px + textX0;
  let y = py + pad + (panelH - pad * 2 - contentH) / 2 + titlePx;

  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 3 * u;
  ctx.shadowOffsetY = 1 * u;

  // Title + flag
  ctx.font = `500 ${titlePx}px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  const flagW = flag ? titlePx * 1.5 : 0;
  const titleText = fitText(ctx, title, textW - flagW);
  ctx.fillText(titleText, tx, y);
  if (flag) {
    const tw = ctx.measureText(titleText).width;
    ctx.font = `${titlePx * 0.95}px ${EMOJI_FONT}`;
    ctx.fillText(flag, tx + tw + titlePx * 0.3, y);
  }
  y += titlePx * 0.25 + bodyLH;

  // Body lines
  ctx.font = `400 ${bodyPx}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  for (const line of bodyLines) {
    ctx.fillText(fitText(ctx, line, textW), tx, y);
    y += bodyLH;
  }

  ctx.restore();
}
