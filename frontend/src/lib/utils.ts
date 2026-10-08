export function formatRating(avg: number, count: number) {
  const a = Number.isFinite(avg) ? avg : 0;
  const c = Number.isFinite(count) ? count : 0;
  return `${a.toFixed(1)} (${c})`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

