import { useState, useEffect, useCallback } from 'react';

export type GPSPosition = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  heading: number | null;
  speed: number | null;
};

export function useGPS(enabled: boolean = true) {
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return () => {};
    }
    setLoading(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const cleanup = start();
    return cleanup;
  }, [enabled, start]);

  return { position, error, loading };
}
