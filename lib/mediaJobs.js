/**
 * Media async job helpers — imageInfo + videoInfo (production-normalized).
 * Copy nguyên từ _shared/mediaJobHelpers.js — không rút gọn.
 */

function pickNested(value, paths) {
  for (const p of paths) {
    const found = p.split('.').reduce((cur, key) => cur?.[key], value);
    if (found !== undefined && found !== null && found !== '') return found;
  }
  return undefined;
}

function getFirstArrayItem(value) {
  return Array.isArray(value) && value.length > 0 ? value[0] : undefined;
}

export function coerceInfoBlock(raw, seen) {
  if (raw == null) return null;
  if (typeof raw === 'object') {
    const tracker = seen || new WeakSet();
    if (tracker.has(raw)) return null;
    tracker.add(raw);
    seen = tracker;
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    return coerceInfoBlock(raw[0], seen);
  }
  if (typeof raw !== 'object') return null;
  if (raw.data != null) {
    const nested = coerceInfoBlock(raw.data, seen);
    if (nested) return nested;
  }
  return raw;
}

export function unwrapMediaPayloadCandidates(payload) {
  const candidates = [];
  const add = (v) => {
    if (!v || typeof v !== 'object') return;
    if (!candidates.includes(v)) candidates.push(v);
  };
  add(payload);
  add(payload?.data);
  add(getFirstArrayItem(payload?.data));
  add(coerceInfoBlock(payload?.imageInfo));
  add(coerceInfoBlock(payload?.videoInfo));
  add(coerceInfoBlock(payload?.musicInfo));
  add(coerceInfoBlock(payload?.data?.imageInfo));
  add(coerceInfoBlock(payload?.data?.videoInfo));
  add(getFirstArrayItem(payload?.images));
  add(getFirstArrayItem(payload?.videos));
  add(getFirstArrayItem(payload?.data?.images));
  add(getFirstArrayItem(payload?.data?.videos));
  return candidates;
}

export function unwrapGenerationInfo(payload, kind = 'image') {
  const key = kind === 'video' ? 'videoInfo' : kind === 'music' ? 'musicInfo' : 'imageInfo';
  const info =
    coerceInfoBlock(payload?.[key]) ??
    coerceInfoBlock(payload?.data?.[key]) ??
    coerceInfoBlock(payload?.data?.data?.[key]);
  return info || payload;
}

export function normalizeMediaCreateResponse(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const inner = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : null;
  const imageInfo = coerceInfoBlock(raw.imageInfo ?? inner?.imageInfo);
  const videoInfo = coerceInfoBlock(raw.videoInfo ?? inner?.videoInfo);
  const musicInfo = coerceInfoBlock(raw.musicInfo ?? inner?.musicInfo);

  const idFrom = (info, keys) => {
    if (!info) return '';
    for (const k of keys) {
      const v = String(info[k] ?? '').trim();
      if (v) return v;
    }
    return '';
  };

  let id_base =
    idFrom(imageInfo, ['id_base', 'id', 'image_id']) ||
    idFrom(videoInfo, ['id_base', 'id', 'video_id', 'videoId']) ||
    idFrom(musicInfo, ['id_base', 'id']) ||
    String(
      inner?.id_base ??
        inner?.id ??
        raw.id_base ??
        raw.id ??
        inner?.task_id ??
        raw.task_id ??
        raw.requestInfo?.id_base ??
        '',
    ).trim();

  const task_id = String(
    inner?.task_id ?? raw.task_id ?? videoInfo?.task_id ?? imageInfo?.task_id ?? '',
  ).trim();
  const message = inner?.message ?? raw.message ?? videoInfo?.message ?? imageInfo?.message;
  const status = String(
    videoInfo?.status ?? imageInfo?.status ?? musicInfo?.status ?? inner?.status ?? raw.status ?? '',
  ).trim();
  const video_id = idFrom(videoInfo, ['video_id', 'videoId', 'id_base', 'id']);

  const rawImageInfo = raw.imageInfo ?? inner?.imageInfo;
  const rawVideoInfo = raw.videoInfo ?? inner?.videoInfo;
  const rawMusicInfo = raw.musicInfo ?? inner?.musicInfo;
  const imageNotFound = Array.isArray(rawImageInfo) && rawImageInfo.length === 0;
  const videoNotFound = Array.isArray(rawVideoInfo) && rawVideoInfo.length === 0;
  const musicNotFound = Array.isArray(rawMusicInfo) && rawMusicInfo.length === 0;

  const media_kind =
    videoInfo || videoNotFound
      ? 'video'
      : imageInfo || imageNotFound
        ? 'image'
        : musicInfo || musicNotFound
          ? 'music'
          : status.includes('MEDIA_')
            ? 'video'
            : 'image';

  const notFound =
    (media_kind === 'video' && videoNotFound) ||
    (media_kind === 'image' && imageNotFound) ||
    (media_kind === 'music' && musicNotFound);

  const imageUrl = imageInfo ? extractImageUrls(imageInfo)[0] || '' : '';
  const videoUrl = videoInfo ? extractVideoUrls(videoInfo)[0] || '' : '';
  const musicUrl = musicInfo
    ? String(musicInfo.audio_url ?? musicInfo.download_url ?? musicInfo.url ?? '').trim()
    : '';

  const imageInfoOut = imageInfo
    ? {
        ...imageInfo,
        ...buildJobStatusFlags(imageInfo.status ?? status, 'image', {
          downloadUrl: imageUrl,
          notFound: imageNotFound,
        }),
      }
    : null;
  const videoInfoOut = videoInfo
    ? {
        ...videoInfo,
        ...buildJobStatusFlags(videoInfo.status ?? status, 'video', {
          downloadUrl: videoUrl,
          notFound: videoNotFound,
        }),
      }
    : null;
  const musicInfoOut = musicInfo
    ? {
        ...musicInfo,
        ...buildJobStatusFlags(musicInfo.status ?? status, 'music', {
          downloadUrl: musicUrl,
          notFound: musicNotFound,
        }),
      }
    : null;

  const draft = {
    ...(inner || {}),
    ...(imageInfoOut ? { imageInfo: imageInfoOut } : {}),
    ...(videoInfoOut ? { videoInfo: videoInfoOut } : {}),
    ...(musicInfoOut ? { musicInfo: musicInfoOut } : {}),
    ...(raw.modelInfo ? { modelInfo: raw.modelInfo } : {}),
    ...(raw.requestInfo ? { requestInfo: raw.requestInfo } : {}),
    ...(id_base ? { id_base } : {}),
    ...(video_id ? { video_id } : {}),
    ...(task_id ? { task_id } : {}),
    ...(message ? { message } : {}),
    ...(status ? { status } : {}),
    media_kind,
  };

  const download_url = resolveMediaUrlFromNormalized(
    draft,
    unwrapGenerationInfo(draft, media_kind),
    media_kind,
  );
  const jobFlags = buildJobStatusFlags(status, media_kind, { downloadUrl: download_url, notFound });

  return {
    ...draft,
    ...jobFlags,
    ...(download_url ? { download_url, url: download_url, has_url: true } : { has_url: false }),
    success: raw.success ?? inner?.success,
  };
}

export function buildJobStatusFlags(status, kind = 'auto', opts = {}) {
  const { downloadUrl = '', notFound = false } = opts;
  if (notFound) {
    return {
      job_status: 'not_found',
      is_pending: false,
      is_success: false,
      is_failed: false,
      is_not_found: true,
      has_url: false,
      is_ready: false,
    };
  }
  const url = String(downloadUrl ?? '').trim();
  const has_url = !!url;
  const mediaKind =
    kind === 'auto' ? (String(status ?? '').includes('MEDIA_') ? 'video' : 'image') : kind;
  let phase = classifyMediaStatus(status, mediaKind);
  if (url && phase !== 'failed') phase = 'success';
  if (phase === 'unknown') phase = url ? 'success' : 'pending';
  return {
    job_status: phase,
    is_pending: phase === 'pending',
    is_success: phase === 'success',
    is_failed: phase === 'failed',
    is_not_found: false,
    has_url,
    is_ready: phase === 'success' && has_url,
  };
}

export function getMediaJobId(payload, kind = 'auto') {
  const normalized = normalizeMediaCreateResponse(payload);
  if (kind === 'image') {
    const info = unwrapGenerationInfo(normalized, 'image');
    return String(info?.id_base ?? info?.id ?? info?.image_id ?? normalized.id_base ?? '').trim();
  }
  if (kind === 'video') {
    const info = unwrapGenerationInfo(normalized, 'video');
    return String(
      info?.id_base ??
        info?.id ??
        info?.video_id ??
        info?.videoId ??
        normalized.id_base ??
        normalized.video_id ??
        '',
    ).trim();
  }
  if (kind === 'music') {
    const info = unwrapGenerationInfo(normalized, 'music');
    return String(info?.id_base ?? info?.id ?? normalized.id_base ?? '').trim();
  }
  return getJobId(normalized);
}

export function getJobId(payload) {
  const normalized = normalizeMediaCreateResponse(payload);
  const fromPaths = String(
    pickNested(normalized, [
      'id_base',
      'id',
      'job_id',
      'image_id',
      'video_id',
      'videoId',
      'task_id',
      'data.id_base',
      'data.id',
      'data.job_id',
      'data.task_id',
      'imageInfo.id_base',
      'imageInfo.id',
      'imageInfo.image_id',
      'videoInfo.id_base',
      'videoInfo.id',
      'videoInfo.video_id',
      'videoInfo.videoId',
      'data.imageInfo.id_base',
      'data.videoInfo.id_base',
      'data.videoInfo.video_id',
      'data.imageInfo.id',
      'data.videoInfo.id',
      'musicInfo.id_base',
      'musicInfo.id',
      'requestInfo.id_base',
    ]) || '',
  ).trim();
  if (fromPaths) return fromPaths;
  const dataArr = normalized?.data;
  if (Array.isArray(dataArr) && dataArr[0]) {
    const row = dataArr[0];
    const nested = String(row.id_base ?? row.id ?? row.job_id ?? row.video_id ?? '').trim();
    if (nested) return nested;
  }
  return '';
}

function getPayloadStatusFromNormalized(normalized) {
  return String(
    pickNested(normalized, [
      'status',
      'state',
      'task_status',
      'imageInfo.status',
      'imageInfo.state',
      'videoInfo.status',
      'videoInfo.state',
      'musicInfo.status',
      'data.status',
      'data.state',
      'data.imageInfo.status',
      'data.videoInfo.status',
      'requestInfo.status',
    ]) || '',
  ).toUpperCase();
}

export function getMediaUrl(payload, kind = 'auto') {
  const normalized = normalizeMediaCreateResponse(payload);
  return getMediaUrlFromNormalized(normalized, kind);
}

function getMediaUrlFromNormalized(normalized, kind = 'auto') {
  const candidates = unwrapMediaPayloadCandidates(normalized);
  const videoPaths = [
    'download_url',
    'video_url',
    'file_url',
    'output_url',
    'url',
    'extra_data.download_url',
    'extra_data.url',
    'data.download_url',
    'data.video_url',
    'data.url',
  ];
  const imagePaths = [
    'url',
    'image_url',
    'download_url',
    'file_url',
    'output_url',
    'url_preview',
    'data.url',
    'data.image_url',
    'data.download_url',
  ];
  const musicPaths = [
    'audio_url',
    'download_url',
    'url',
    'file_url',
    'output_url',
    'data.audio_url',
    'data.download_url',
    'data.url',
  ];
  const paths =
    kind === 'video'
      ? videoPaths
      : kind === 'image'
        ? imagePaths
        : kind === 'music'
          ? musicPaths
          : [...videoPaths, ...imagePaths, ...musicPaths];
  const url =
    candidates.map((item) => pickNested(item, paths)).find(Boolean) ||
    pickNested(normalized, [
      'download_url',
      'url',
      'imageInfo.url',
      'imageInfo.download_url',
      'imageInfo.image_url',
      'imageInfo.url_preview',
      'videoInfo.url',
      'videoInfo.download_url',
      'videoInfo.video_url',
      'videoInfo.extra_data.download_url',
      'videoInfo.extra_data.url',
      'musicInfo.audio_url',
      'musicInfo.download_url',
      'musicInfo.url',
      'data.imageInfo.url',
      'data.videoInfo.download_url',
      'data.musicInfo.audio_url',
      'data.musicInfo.download_url',
      'data.musicInfo.url',
    ]);
  return typeof url === 'string' ? url.trim() : '';
}

function resolveMediaUrlFromNormalized(normalized, info, kind = 'auto') {
  const mediaKind =
    kind === 'auto'
      ? normalized.media_kind ||
        (getPayloadStatusFromNormalized(normalized).includes('MEDIA_') ? 'video' : 'image')
      : kind;
  const direct =
    getMediaUrlFromNormalized(normalized, mediaKind) || getMediaUrlFromNormalized(info, mediaKind);
  if (direct) return direct;
  const fromInfo =
    mediaKind === 'video'
      ? extractVideoUrls(info)[0]
      : mediaKind === 'music'
        ? extractMusicUrls(info)[0]
        : extractImageUrls(info)[0];
  if (fromInfo) return fromInfo;
  const block =
    mediaKind === 'video'
      ? normalized.videoInfo
      : mediaKind === 'music'
        ? normalized.musicInfo
        : normalized.imageInfo;
  if (block) {
    const fromBlock =
      mediaKind === 'video'
        ? extractVideoUrls(block)[0]
        : mediaKind === 'music'
          ? extractMusicUrls(block)[0]
          : extractImageUrls(block)[0];
    if (fromBlock) return fromBlock;
  }
  return String(normalized.download_url ?? normalized.url ?? '').trim();
}

export function resolveMediaUrl(payload, info, kind = 'auto') {
  const normalized = normalizeMediaCreateResponse(payload);
  return resolveMediaUrlFromNormalized(normalized, info, kind);
}

export function getPayloadStatus(payload) {
  const normalized = normalizeMediaCreateResponse(payload);
  return getPayloadStatusFromNormalized(normalized);
}

const IMAGE_SUCCESS = new Set(['SUCCESS']);
const IMAGE_PENDING = new Set(['PENDING_ACTIVE', 'PROCESSING', 'PENDING_PROCESSING', 'PENDING']);

const VIDEO_SUCCESS = new Set([
  'SUCCESS',
  'SUCCEEDED',
  'COMPLETED',
  'COMPLETE',
  'DONE',
  'FINISHED',
  'READY',
  'RENDERED',
  'GENERATED',
  'MEDIA_GENERATION_STATUS_SUCCESSFUL',
  'SUCCESSFUL',
]);
const VIDEO_PENDING = new Set([
  'PENDING',
  'PENDING_ACTIVE',
  'PENDING_PROCESSING',
  'PROCESSING',
  'ACTIVE',
  'QUEUED',
  'IN_QUEUE',
  'WAITING',
  'RUNNING',
  'IN_PROGRESS',
  'CREATED',
  'SUBMITTED',
  'STARTED',
  'MEDIA_GENERATION_STATUS_PENDING',
  'MEDIA_GENERATION_STATUS_ACTIVE',
  'MEDIA_GENERATION_STATUS_PROCESSING',
  'MEDIA_GENERATION_STATUS_RUNNING',
]);
const MEDIA_FAIL = new Set([
  'ERROR',
  'FAILED',
  'FAIL',
  'LIMIT_TIME',
  'TIMEOUT',
  'TIMED_OUT',
  'CANCELLED',
  'CANCELED',
  'REJECTED',
  'UNKNOWN',
  'MEDIA_GENERATION_STATUS_FAILED',
  'PUBLIC_ERROR_VIDEO_GENERATION_TIMED_OUT',
]);

const BUSY_MSG = /đã tiếp nhận|đang xử lý|queued|pending|processing|^processing(\s+video)?\.{0,3}$/i;

export function isBusyProgressNoiseMessage(message) {
  const s = String(message ?? '').trim();
  if (!s) return true;
  return s === 'đang xử lý...' || s === 'đang xử lý video...' || BUSY_MSG.test(s);
}

export function isUnsafeGenerationStatus(status) {
  const u = String(status || '').toUpperCase();
  return u.includes('UNSAFE') || u.includes('PUBLIC_ERROR_UNSAFE_GENERATION');
}

export function classifyMediaStatus(status, kind = 'video') {
  const st = String(status || '').trim().toUpperCase();
  if (!st) return 'pending';
  if (kind === 'image') {
    if (IMAGE_SUCCESS.has(st)) return 'success';
    if (IMAGE_PENDING.has(st)) return 'pending';
  } else {
    if (VIDEO_SUCCESS.has(st)) return 'success';
    if (VIDEO_PENDING.has(st)) return 'pending';
  }
  if (MEDIA_FAIL.has(st)) return 'failed';
  if (/FAILED|FAIL|\bERROR\b|LIMIT_TIME|TIMEOUT|TIMED_OUT|CANCEL/.test(st)) return 'failed';
  return 'unknown';
}

export function isPendingAccepted(payload, kind = 'auto') {
  const normalized = normalizeMediaCreateResponse(payload);
  const msg = String(
    pickNested(normalized, [
      'message',
      'data.message',
      'imageInfo.message',
      'videoInfo.message',
      'data.imageInfo.message',
      'data.videoInfo.message',
    ]) || '',
  ).toLowerCase();
  if (BUSY_MSG.test(msg)) return true;
  const st = getPayloadStatus(normalized);
  const mediaKind =
    kind === 'auto'
      ? st.includes('MEDIA_') || coerceInfoBlock(normalized?.videoInfo)
        ? 'video'
        : 'image'
      : kind;
  return classifyMediaStatus(st, mediaKind) === 'pending';
}

export function isFinalMediaStatus(status, mediaUrl) {
  const st = String(status || '').toUpperCase();
  if (mediaUrl && classifyMediaStatus(st) === 'pending') return false;
  if (VIDEO_SUCCESS.has(st) || IMAGE_SUCCESS.has(st)) return true;
  if (mediaUrl && classifyMediaStatus(st) !== 'failed') return true;
  return false;
}

export function isFailedMediaStatus(status) {
  return classifyMediaStatus(status) === 'failed';
}

export function resolveFailureMessage(payload, fallback = 'Tạo media không thành công.') {
  const normalized = normalizeMediaCreateResponse(payload);
  if (
    isUnsafeGenerationStatus(getPayloadStatus(normalized)) ||
    isUnsafeGenerationStatus(normalized?.message)
  ) {
    return 'Vi phạm chính sách';
  }
  const st = getPayloadStatus(normalized);
  if (!isFailedMediaStatus(st)) return '';
  const err = pickNested(normalized, [
    'error',
    'imageInfo.error',
    'videoInfo.error',
    'message',
    'imageInfo.message',
    'videoInfo.message',
  ]);
  if (typeof err === 'string' && err.trim() && !isBusyProgressNoiseMessage(err)) return err.trim();
  if (st === 'LIMIT_TIME') return 'Hết thời gian xử lý (Limit Time)';
  return fallback;
}

export function parseMediaCreateResponse(res, kind = 'auto') {
  const normalized = normalizeMediaCreateResponse(res);
  const mediaKind = kind === 'auto' ? (coerceInfoBlock(normalized?.videoInfo) ? 'video' : 'image') : kind;
  const jobId = getMediaJobId(normalized, mediaKind);
  const info = unwrapGenerationInfo(normalized, mediaKind);
  if (!jobId && !isPendingAccepted(normalized, mediaKind) && !getMediaUrl(normalized, mediaKind)) {
    throw new Error(`Không lấy được job id từ response tạo ${mediaKind === 'video' ? 'video' : 'ảnh'}`);
  }
  return { jobId, raw: normalized, info, kind: mediaKind };
}

export async function pollMediaJob(kind, jobId, opts = {}) {
  const endpoint =
    kind === 'image'
      ? '/ai/image'
      : kind === 'music'
        ? '/api/apps/go-mmo/ai_musics/getInfo'
        : '/ai/video';
  const intervalMs = opts.intervalMs ?? 15000;
  const maxWaitMs = opts.maxWaitMs ?? 3 * 60 * 60 * 1000;
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;
  const body =
    kind === 'video'
      ? { id_base: jobId, id: jobId, videoId: jobId }
      : kind === 'music'
        ? { id_base: jobId, ...(opts.projectId ? { project_id: opts.projectId } : {}) }
        : { id_base: jobId, id: jobId };

  while (Date.now() < deadline) {
    if (opts.isCancelled?.()) throw new Error('Đã hủy');
    attempt += 1;
    if (attempt > 1) await new Promise((r) => setTimeout(r, intervalMs));
    else await new Promise((r) => setTimeout(r, 1200));

    const raw = await window.gommoMiniApp.call('api.call', {
      endpoint,
      method: 'POST',
      body,
    });
    const payload = normalizeMediaCreateResponse(raw);
    opts.onProgress?.(payload);

    const info = unwrapGenerationInfo(payload, kind);
    const status = getPayloadStatus(payload) || getPayloadStatus(info);
    const url = resolveMediaUrl(payload, info, kind);

    if (payload.is_not_found) {
      throw new Error('Media job not found');
    }
    if (payload.is_failed || isUnsafeGenerationStatus(status)) {
      if (isUnsafeGenerationStatus(status)) {
        throw new Error('Vi phạm chính sách');
      }
      throw new Error(resolveFailureMessage(info, resolveFailureMessage(payload, 'Media failed')));
    }
    const statusSuccess = payload.is_success || classifyMediaStatus(status, kind) === 'success';
    if (url && (payload.is_ready || statusSuccess || isFinalMediaStatus(status, url))) {
      const urls =
        kind === 'video'
          ? [...new Set([...extractVideoUrls(info), ...extractVideoUrls(payload?.videoInfo), url])]
          : kind === 'music'
            ? [...new Set([...extractMusicUrls(info), ...extractMusicUrls(payload?.musicInfo), url])]
            : [...new Set([...extractImageUrls(info), ...extractImageUrls(payload?.imageInfo), url])];
      return { payload, info, url, download_url: url, urls, status };
    }
  }
  throw new Error('Media job timeout');
}

export function extractImageUrls(info) {
  const urls = [];
  const push = (u) => {
    if (typeof u === 'string' && u.trim()) urls.push(u.trim());
  };
  push(info?.url);
  push(info?.download_url);
  push(info?.image_url);
  push(info?.url_preview);
  push(info?.file_url);
  push(info?.output_url);
  push(info?.media_url);
  if (Array.isArray(info?.files))
    info.files.forEach((f) => {
      if (typeof f === 'string') push(f);
      else push(f?.url ?? f?.download_url ?? f?.image_url);
    });
  if (Array.isArray(info?.images))
    info.images.forEach((f) => {
      if (typeof f === 'string') push(f);
      else push(f?.url ?? f?.download_url);
    });
  if (Array.isArray(info?.resolutions))
    info.resolutions.forEach((r) => push(r?.url ?? r?.download_url));
  return [...new Set(urls)];
}

export function extractVideoUrls(info) {
  const urls = [];
  const push = (u) => {
    if (typeof u === 'string' && u.trim()) urls.push(u.trim());
  };
  push(info?.download_url);
  push(info?.video_url);
  push(info?.url);
  push(info?.file_url);
  push(info?.output_url);
  push(info?.media_url);
  push(info?.extra_data?.download_url);
  push(info?.extra_data?.url);
  if (Array.isArray(info?.files))
    info.files.forEach((f) => {
      if (typeof f === 'string') push(f);
      else push(f?.download_url ?? f?.url ?? f?.video_url);
    });
  return [...new Set(urls)];
}

export function extractMusicUrls(info) {
  const urls = [];
  const push = (u) => {
    if (typeof u === 'string' && u.trim()) urls.push(u.trim());
  };
  push(info?.audio_url);
  push(info?.download_url);
  push(info?.url);
  push(info?.file_url);
  push(info?.output_url);
  push(info?.media_url);
  if (Array.isArray(info?.files))
    info.files.forEach((f) => {
      if (typeof f === 'string') push(f);
      else push(f?.audio_url ?? f?.download_url ?? f?.url);
    });
  return [...new Set(urls)];
}