/**
 * Thư viện video theo project — NGUỒN DỮ LIỆU SERVER.
 *
 * Root cause LỖI 2: app chỉ render `sessions[].scenes[]` (state local), không có
 * bất kỳ call List Videos nào → video SUCCESS mất khi đổi tab/session hoặc F5.
 *
 * project_id dùng để QUERY lấy từ getApiProjectId() — ĐÚNG hàm mà engine.runScene
 * dùng khi TẠO job → không thể "tạo ở project A, xem danh sách của project B".
 */

import { gommoApi, toItems } from './api.js';
import { getApiProjectId, isProjectResolved } from './projectState.js';
import { ensureProjectBridgeGuard } from './projectBridge.js';

/**
 * Thứ tự thử endpoint: /ai/videos (API gốc) → /ai/jobs?media=video (gateway v2).
 * Nếu endpoint đầu lỗi (404/không hỗ trợ), thử endpoint sau; project_id luôn được
 * gửi tường minh trong body nên không phụ thuộc interceptor.
 */
const LIST_ENDPOINTS = [
  { endpoint: '/ai/videos', method: 'POST', extra: {} },
  { endpoint: '/ai/jobs', method: 'POST', extra: { media: 'video', type: 'video' } },
];

function firstString(row, keys) {
  for (const k of keys) {
    const v = row?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

/** Chuẩn hoá 1 row video từ API list — dò nhiều tên field vì response khác nhau giữa host. */
export function normalizeLibraryVideo(row) {
  if (!row || typeof row !== 'object') return null;
  const nested =
    (row.result && typeof row.result === 'object' ? row.result : null) ||
    (row.videoInfo && typeof row.videoInfo === 'object' && !Array.isArray(row.videoInfo)
      ? row.videoInfo
      : Array.isArray(row.videoInfo) && row.videoInfo[0] && typeof row.videoInfo[0] === 'object'
        ? row.videoInfo[0]
        : null) ||
    (row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : null);
  const merged = nested ? { ...nested, ...row } : row;

  const url = firstString(merged, [
    'url',
    'video_url',
    'videoUrl',
    'download_url',
    'downloadUrl',
    'file_url',
    'output_url',
    'result_url',
  ]) || firstString(nested || {}, ['url', 'video_url', 'download_url', 'downloadUrl']);

  const id = firstString(merged, ['id_base', 'idBase', 'video_id', 'videoId', 'id', 'task_id']);
  if (!url && !id) return null;

  return {
    id: id || url,
    url,
    thumb: firstString(merged, ['thumb', 'thumbnail', 'thumb_url', 'cover', 'preview_url']),
    status: firstString(merged, ['status', 'state']),
    createdAt: firstString(merged, ['created_at', 'createdAt', 'time_create', 'created']),
    projectId: firstString(merged, ['project_id', 'projectId']),
    prompt: firstString(merged, ['prompt', 'description']),
    raw: row,
  };
}

function recordQueryDebug(endpoint, projectId) {
  if (typeof window === 'undefined') return;
  const log = (window.__gommoProjectDebug = window.__gommoProjectDebug || []);
  log.push({
    at: new Date().toISOString(),
    endpoint: String(endpoint || ''),
    method: 'POST',
    project_id: String(projectId || ''),
    source: 'libraryQuery',
  });
  if (log.length > 50) log.shift();
}

/**
 * Query danh sách video của project đang chọn.
 * Trả { items, projectId, endpoint, error } — không throw để UI hiển thị lỗi thật.
 */
export async function listProjectVideos(options = {}) {
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 60));
  ensureProjectBridgeGuard();
  const projectId = getApiProjectId();

  // ĐIỂM LOG 3/3: lúc query danh sách (2 điểm còn lại: lúc chọn project, lúc gửi tạo job).
  console.info(
    `[project] library query project_id="${projectId}" (cùng nguồn getApiProjectId với lúc tạo job)`,
  );

  if (!projectId || !isProjectResolved()) {
    return {
      items: [],
      projectId,
      endpoint: '',
      error:
        'Chưa xác định được project — mở panel "0 · Project" và chọn project trước khi xem thư viện.',
    };
  }

  let lastError = '';
  for (const cfg of LIST_ENDPOINTS) {
    try {
      recordQueryDebug(cfg.endpoint, projectId);
      // eslint-disable-next-line no-await-in-loop
      const res = await gommoApi(cfg.endpoint, {
        method: cfg.method,
        body: { ...cfg.extra, project_id: projectId, page: 1, limit },
      });
      const rawItems = toItems(res);
      console.info(`[library] [sau khi gọi API list] ${cfg.endpoint} trả về ${rawItems.length} raw video:`, rawItems);
      const items = rawItems.map(normalizeLibraryVideo).filter(Boolean);
      console.info(`[library] Sau normalize: ${items.length}/${rawItems.length} video hợp lệ`);
      if (items.length > 0) {
        return { items, projectId, endpoint: cfg.endpoint, error: '' };
      }
      // Endpoint trả rỗng (không lỗi) → coi như project chưa có video, không thử tiếp.
      lastError = '';
      return { items: [], projectId, endpoint: cfg.endpoint, error: '' };
    } catch (error) {
      lastError = error?.message || String(error);
    }
  }

  return { items: [], projectId, endpoint: '', error: lastError };
}

export default { listProjectVideos, normalizeLibraryVideo };