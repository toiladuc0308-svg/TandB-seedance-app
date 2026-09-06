/** Suy ra duration output từ số giây của video tham chiếu. */

import { resolveVideoActiveSource, getMediaOptionsFromSource } from './modelCatalog.js';

/** '5s' | 5 | '10' → number giây (0 nếu không parse được). */
export function parseSeconds(value) {
  if (value == null) return 0;
  const raw = String(value).trim().toLowerCase().replace(/s$/, '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Danh sách duration hợp lệ của model/variant đang chọn, sort tăng dần. */
export function getDurationOptions(model, settings) {
  const source = resolveVideoActiveSource(model, settings?.mode);
  const opts = getMediaOptionsFromSource(source);
  return (opts.durations || [])
    .map((o) => ({ ...o, seconds: parseSeconds(o.type) }))
    .filter((o) => o.seconds > 0)
    .sort((a, b) => a.seconds - b.seconds);
}

/** Chọn option gần/đủ dài nhất so với số giây video ref. */
export function pickDurationForSeconds(options, seconds) {
  const list = Array.isArray(options) ? options : [];
  const target = Number(seconds) || 0;
  if (list.length === 0 || target <= 0) return '';
  const exact = list.find((o) => Math.abs(o.seconds - target) < 0.6);
  if (exact) return exact.type;
  const ceil = list.find((o) => o.seconds >= target);
  if (ceil) return ceil.type;
  return list[list.length - 1].type;
}

/** Mode thời lượng: 'auto' (theo video upload) | 'manual'. Mặc định auto. */
export function isAutoDurationMode(settings) {
  if (settings?.durationMode) return settings.durationMode === 'auto';
  if (typeof settings?.durationFromVideo === 'boolean') return settings.durationFromVideo;
  return true;
}

/** Trả settings mới với duration khớp video ref (giữ nguyên nếu không suy được). */
export function applyDurationFromSeconds(model, settings, seconds) {
  const options = getDurationOptions(model, settings);
  const picked = pickDurationForSeconds(options, seconds);
  if (!picked) return settings;
  return { ...settings, duration: picked };
}

export default {
  parseSeconds,
  getDurationOptions,
  pickDurationForSeconds,
  applyDurationFromSeconds,
  isAutoDurationMode,
};