import { useState, useRef, useCallback, useEffect } from 'react';

export type FacingMode = 'environment' | 'user';

export type CameraResolution = {
  label: string;
  width: number;
  height: number;
};

export const CAMERA_RESOLUTIONS: CameraResolution[] = [
  { label: 'UHD 4K', width: 3840, height: 2160 },
  { label: '2K QHD', width: 2560, height: 1440 },
  { label: 'FHD 1080p', width: 1920, height: 1080 },
  { label: 'HD 720p', width: 1280, height: 720 },
];

// Hardware-encoded formats first: they record smoothly on phones and play back without stutter
const VIDEO_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/webm;codecs=h264,opus',
  'video/webm;codecs=vp8,opus',
  'video/mp4',
  'video/webm',
];

function pickVideoMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return VIDEO_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

function bitrateFor(width: number, height: number): number {
  const px = width * height;
  if (px >= 3840 * 2160 * 0.9) return 24_000_000;
  if (px >= 2560 * 1440 * 0.9) return 14_000_000;
  if (px >= 1920 * 1080 * 0.9) return 8_000_000;
  return 5_000_000;
}

// Try the requested resolution first, then step down, so a camera always opens
async function openStream(facingMode: FacingMode, res: CameraResolution): Promise<MediaStream> {
  const startIdx = Math.max(
    0,
    CAMERA_RESOLUTIONS.findIndex((r) => r.width === res.width)
  );
  const attempts: MediaStreamConstraints[] = CAMERA_RESOLUTIONS.slice(startIdx).map((r) => ({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: r.width },
      height: { ideal: r.height },
      frameRate: { ideal: 30 },
    },
    audio: false,
  }));
  attempts.push({ video: { facingMode: { ideal: facingMode } }, audio: false });
  attempts.push({ video: true, audio: false });

  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastError = e;
      // Permission denial won't be fixed by a lower resolution
      if (e instanceof DOMException && e.name === 'NotAllowedError') break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Camera unavailable');
}

export type ActualResolution = { width: number; height: number } | null;

export function useCameraAdvanced() {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [facing, setFacing] = useState<FacingMode>('environment');
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualRes, setActualRes] = useState<ActualResolution>(null);

  const bindStream = (el: HTMLVideoElement, stream: MediaStream) => {
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});
  };

  // Callback ref: attaches the stream whenever the <video> mounts (it may mount after the stream opens)
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) bindStream(el, streamRef.current);
  }, []);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = useCallback(async (facingMode: FacingMode, res: CameraResolution) => {
    // Release first: many phones refuse to open a second stream on the same camera
    releaseStream();
    try {
      const s = await openStream(facingMode, res);
      streamRef.current = s;
      const settings = s.getVideoTracks()[0]?.getSettings();
      setActualRes(
        settings?.width && settings?.height
          ? { width: settings.width, height: settings.height }
          : null
      );
      if (videoRef.current) bindStream(videoRef.current, s);
      setHasCamera(true);
      setError(null);
      setFacing(facingMode);
      return s;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Camera error');
      setHasCamera(false);
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    releaseStream();
    setHasCamera(false);
  }, []);

  // Always free the camera when leaving the page
  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      releaseStream();
    },
    []
  );

  const flipCamera = useCallback(
    async (res: CameraResolution) => {
      const newFacing: FacingMode = facing === 'environment' ? 'user' : 'environment';
      await startCamera(newFacing, res);
      return newFacing;
    },
    [facing, startCamera]
  );

  // Captures at the camera's native resolution (no upscaling), cropped to the chosen aspect ratio
  const capturePhoto = useCallback(
    async (
      beautyFilter: string,
      cropAspect: [number, number],
      drawOverlay?: (ctx: CanvasRenderingContext2D, w: number, h: number) => Promise<void>
    ): Promise<Blob | null> => {
      const v = videoRef.current;
      if (!v || !v.videoWidth || !v.videoHeight) return null;

      const [aw, ah] = cropAspect;
      const srcW = v.videoWidth;
      const srcH = v.videoHeight;
      const tgtRatio = aw / ah;
      let cx = 0;
      let cy = 0;
      let cw = srcW;
      let ch = srcH;
      if (srcW / srcH > tgtRatio) {
        cw = Math.round(srcH * tgtRatio);
        cx = Math.round((srcW - cw) / 2);
      } else {
        ch = Math.round(srcW / tgtRatio);
        cy = Math.round((srcH - ch) / 2);
      }

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingQuality = 'high';
      if (beautyFilter) ctx.filter = beautyFilter;
      ctx.drawImage(v, cx, cy, cw, ch, 0, 0, cw, ch);
      ctx.filter = 'none';
      if (drawOverlay) await drawOverlay(ctx, cw, ch);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
      );
      // Free the large bitmap immediately to avoid memory pressure on phones
      canvas.width = 0;
      canvas.height = 0;
      return blob;
    },
    []
  );

  const startVideoRecording = useCallback(async (): Promise<string | null> => {
    const stream = streamRef.current;
    if (!stream) return 'Camera is not running';
    if (typeof MediaRecorder === 'undefined') return 'Video recording is not supported on this browser';

    let audioTracks: MediaStreamTrack[] = [];
    try {
      const audio = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      audioStreamRef.current = audio;
      audioTracks = audio.getAudioTracks();
    } catch {
      // Record without sound if the microphone is unavailable
      audioStreamRef.current = null;
    }

    const combined = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);
    const mimeType = pickVideoMime();
    const settings = stream.getVideoTracks()[0]?.getSettings();
    const options: MediaRecorderOptions = {
      videoBitsPerSecond: bitrateFor(settings?.width ?? 1920, settings?.height ?? 1080),
      audioBitsPerSecond: 128_000,
    };
    if (mimeType) options.mimeType = mimeType;

    try {
      chunksRef.current = [];
      const mr = new MediaRecorder(combined, options);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(1000);
      recorderRef.current = mr;
      setIsRecording(true);
      return null;
    } catch (e) {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
      return e instanceof Error ? e.message : 'Could not start recording';
    }
  }, []);

  const stopVideoRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mr = recorderRef.current;
      if (!mr || mr.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }
      mr.onstop = () => {
        const type = mr.mimeType || 'video/webm';
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null;
        chunksRef.current = [];
        recorderRef.current = null;
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };
      mr.stop();
    });
  }, []);

  return {
    videoRef,
    attachVideo,
    streamRef,
    hasCamera,
    error,
    facing,
    isRecording,
    actualRes,
    startCamera,
    stopCamera,
    flipCamera,
    capturePhoto,
    startVideoRecording,
    stopVideoRecording,
  };
}
