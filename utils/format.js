export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatCredit(n) {
  const num = Number(n || 0);
  return num.toLocaleString('vi-VN');
}

export function nowLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds(),
  ).padStart(2, '0')}`;
}

export function shortName(name, max = 18) {
  const s = String(name || '');
  if (s.length <= max) return s;
  return `${s.slice(0, max - 4)}…${s.slice(-3)}`;
}

/** 15.4 → "15.4s", 92 → "1m32s" */
export function formatSeconds(seconds) {
  const n = Number(seconds) || 0;
  if (n <= 0) return '—';
  if (n < 60) return `${Math.round(n * 10) / 10}s`;
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}m${String(s).padStart(2, '0')}s`;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/** Fake progress curve: nhanh lúc đầu, chậm dần, cap 96% khi chưa xong. */
export function simulatedPercent(elapsedMs, expectedMs) {
  const t = Math.max(0, elapsedMs) / Math.max(1000, expectedMs);
  const eased = 1 - Math.exp(-2.2 * t);
  return Math.min(96, Math.round(eased * 100));
}