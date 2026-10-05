declare module 'open-location-code' {
  export function encode(latitude: number, longitude: number, codeLength?: number): string;
  export function decode(code: string): { latitudeCenter: number; longitudeCenter: number };
  export function isValid(code: string): boolean;
  export function isShort(code: string): boolean;
  export function isFull(code: string): boolean;
  export function shorten(code: string, latitude: number, longitude: number): string;
}
