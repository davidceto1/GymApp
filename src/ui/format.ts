import { formatWeight } from '../logic/weights';

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function formatRestGuide(seconds: number): string {
  const min = seconds / 60;
  return Number.isInteger(min) ? `${min} min` : `${Math.round(min * 10) / 10} min`;
}

export function formatDate(
  ms: number,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
): string {
  return new Date(ms).toLocaleDateString(undefined, opts);
}

export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function readText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsText(file);
  });
}

/** "60kg", or "BW" for a bodyweight-only (non-barbell, 0 weight) exercise. */
export function formatLoad(weight: number, unit: string, equipment: 'barbell' | 'other'): string {
  return equipment === 'other' && weight === 0 ? 'BW' : `${formatWeight(weight)}${unit}`;
}
