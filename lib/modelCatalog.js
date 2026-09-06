/** Model catalog helpers — normalize /ai/models + build create-video body. */

import { toItems, gommoApi } from './api.js';

const OFFLINE_STATUSES = new Set([
  'maintenance',
  'off',
  'disabled',
  'inactive',
  'offline',
  'down',
]);

export function normalizeMediaOption(opt) {
  if (opt != null && typeof opt === 'object') {
    const type = String(opt.type || opt.value || '').trim();
    const name = String(opt.name || opt.label || type || '').trim();
    return {
      type: type || name,
      name: name || type,
      group: opt.group != null ? String(opt.group) : undefined,
      group_subtitle: opt.group_subtitle != null ? String(opt.group_subtitle) : undefined,
      description: opt.description != null ? String(opt.description) : undefined,
      price: typeof opt.price === 'number' ? opt.price : undefined,
      status: opt.status != null ? String(opt.status) : undefined,
      value: opt.value != null ? String(opt.value) : undefined,
    };
  }
  const raw = String(opt ?? '').trim();
  const asNum = Number(raw);
  return {
    type: raw,
    name: Number.isFinite(asNum) && raw !== '' ? `${raw}s` : raw,
  };
}

export function normalizeMediaOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map(normalizeMediaOption).filter((o) => o.type);
}

export function isModelStatusOnline(model) {
  if (!model) return false;
  const s = String(model.status ?? '').trim().toLowerCase();
  if (!s || s === 'on' || s === 'active' || s === 'enabled' || s === 'ok') return true;
  return !OFFLINE_STATUSES.has(s);
}

export function isModeOptionDisabled(opt) {
  if (opt == null || typeof opt !== 'object') return false;
  const s = String(opt.status ?? '').toLowerCase().trim();
  return s === 'off' || s === 'pause';
}

export function getModelModes(model) {
  const modes = Array.isArray(model?.modes) ? model.modes : [];
  const mode = Array.isArray(model?.mode) ? model.mode : [];
  const raw = modes.length > 0 ? modes : mode;
  return normalizeMediaOptions(raw);
}

export function modelHasModePicker(model) {
  return getModelModes(model).some((m) => !isModeOptionDisabled(m));
}

export function getVideoConfigVariants(model) {
  const cfg = model?.configs;
  if (!Array.isArray(cfg)) return [];
  return cfg.filter((row) => row && typeof row === 'object');
}

export function resolveVideoActiveSource(model, selectedModeType) {
  const variants = getVideoConfigVariants(model);
  if (variants.length === 0) return model;
  const key = String(selectedModeType || '').trim().toLowerCase();
  if (!key) return variants[0];
  const matched = variants.find((v) => {
    const candidates = [v.type, v.mode, v.name, v.id, v.value].map((x) =>
      String(x || '').trim().toLowerCase(),
    );
    return candidates.includes(key);
  });
  return matched || variants[0];
}

export function getMediaOptionsFromSource(source) {
  if (!source) {
    return { ratios: [], resolutions: [], durations: [], modes: [] };
  }
  return {
    ratios: normalizeMediaOptions(source.ratios),
    resolutions: normalizeMediaOptions(source.resolutions),
    durations: normalizeMediaOptions(source.durations),
    modes: getModelModes(source),
  };
}

export function getModelReferenceConfig(model) {
  const cfg = model?.configs;
  if (!cfg || Array.isArray(cfg)) return null;
  const ref = cfg.reference;
  if (!ref || typeof ref !== 'object' || ref.enabled === false) return null;
  return ref;
}

export function getModelNotices(model) {
  const n = model?.notices;
  return n && typeof n === 'object' && !Array.isArray(n) ? n : null;
}

export function sanitizeVideoModelList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => ({
    ...m,
    id_base: String(m.id_base || m.model || ''),
    model: m.model || m.id_base,
    ratios: normalizeMediaOptions(m.ratios),
    resolutions: normalizeMediaOptions(m.resolutions),
    durations: normalizeMediaOptions(m.durations),
    modes: getModelModes(m),
  }));
}

export function getDefaultMediaSettings(source, fallback = {}) {
  const opts = getMediaOptionsFromSource(source);
  const pick = (list, current) => list.find((r) => r.type === current)?.type || list[0]?.type || '';
  const pickMode = (list, current) => {
    const enabled = list.filter((m) => !isModeOptionDisabled(m));
    const pool = enabled.length ? enabled : list;
    return pool.find((m) => m.type === current)?.type || pool[0]?.type || '';
  };
  return {
    ratio: pick(opts.ratios, fallback.ratio),
    resolution: pick(opts.resolutions, fallback.resolution),
    duration: pick(opts.durations, fallback.duration),
    mode: pickMode(opts.modes, fallback.mode),
  };
}

export function getPriceForModelWithSettings(model, settings = {}, activeSource) {
  const src = activeSource || model;
  const configPrice = src?.price ?? src?.price_credit;
  if (typeof configPrice === 'number' && activeSource && activeSource !== model) {
    return configPrice;
  }
  const prices = model?.prices;
  if (Array.isArray(prices) && prices.length > 0) {
    const exact = prices.find((p) => {
      const resOk = !p.resolution || p.resolution === settings.resolution;
      const modeOk = !p.mode || p.mode === settings.mode;
      const ratioOk = !p.ratio || p.ratio === settings.ratio;
      const durOk = !p.duration || p.duration === settings.duration;
      return resOk && modeOk && ratioOk && durOk;
    });
    if (exact) return exact.price;
    const byRes = prices.find((p) => p.resolution === settings.resolution);
    if (byRes) return byRes.price;
    const byMode = prices.find((p) => p.mode === settings.mode);
    if (byMode) return byMode.price;
    const byDur = prices.find((p) => p.duration === settings.duration);
    if (byDur) return byDur.price;
    const byRatio = prices.find((p) => p.ratio === settings.ratio);
    if (byRatio) return byRatio.price;
    return prices[0].price;
  }
  const modes = getModelModes(model);
  const modeRow = modes.find((m) => m.type === settings.mode);
  if (typeof modeRow?.price === 'number') return modeRow.price;
  if (typeof model?.price === 'number') return model.price;
  if (typeof model?.price_default === 'number') return model.price_default;
  return 0;
}

export function groupModelsByServer(models) {
  const groups = {};
  for (const m of models || []) {
    const raw = String(m.server || 'Other');
    const base = raw.split('_')[0];
    const label = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
    if (!groups[label]) groups[label] = [];
    groups[label].push(m);
  }
  return groups;
}

export async function loadVideoModels() {
  const res = await gommoApi('/ai/models', { method: 'POST', body: { type: 'video' } });
  const raw = toItems(res);
  return sanitizeVideoModelList(raw).filter(isModelStatusOnline);
}

export function pickValidOptionType(options, current) {
  const list = normalizeMediaOptions(options);
  const cur = String(current || '').trim();
  if (cur && list.some((o) => o.type === cur)) return cur;
  return list[0]?.type || '';
}

/** Body cho POST /ai/create-video — KHÔNG có action_type. */
export function buildCreateVideoBody(selectedModel, settings = {}, extra = {}) {
  const model = String(selectedModel?.model || selectedModel?.id_base || '').trim();
  if (!model) throw new Error('Thiếu model — chọn model video từ danh sách');
  const prompt = String(extra.prompt ?? '').trim();
  if (!prompt) throw new Error('Thiếu prompt');

  const activeSource = resolveVideoActiveSource(selectedModel, extra.variantKey);
  const opts = getMediaOptionsFromSource(activeSource);
  const ratio = pickValidOptionType(opts.ratios, settings.ratio);
  const resolution = pickValidOptionType(opts.resolutions, settings.resolution);
  const duration = pickValidOptionType(opts.durations, settings.duration);
  const mode = modelHasModePicker(activeSource)
    ? pickValidOptionType(opts.modes, settings.mode)
    : '';

  const body = {
    model,
    prompt,
    privacy: extra.privacy || 'PRIVATE',
  };
  if (ratio) body.ratio = ratio;
  if (resolution) body.resolution = resolution;
  if (duration) body.duration = duration;
  if (mode) body.mode = mode;
  if (extra.appId) {
    body.app_id = extra.appId;
    body.source_app_id = extra.appId;
    body.mini_app_id = extra.appId;
  }

  (extra.referenceUrls || []).forEach((url, i) => {
    const u = String(url || '').trim();
    if (u) body[`references[${i}][url]`] = u;
  });
  (extra.imageUrls || []).forEach((url, i) => {
    const u = String(url || '').trim();
    if (u) body[`images[${i}][url]`] = u;
  });
  (extra.videoUrls || []).forEach((url, i) => {
    const u = String(url || '').trim();
    if (u) body[`video_urls[${i}][url]`] = u;
  });

  return body;
}