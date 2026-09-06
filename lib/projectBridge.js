/**
 * Bridge guard cho project_id.
 *
 * Vấn đề: interceptor patch bridge.call MỘT LẦN. Nếu parent gán lại
 * window.gommoMiniApp (hoặc ghi đè bridge.call) sau khi patch, các call gọi trực tiếp
 * window.gommoMiniApp.call('api.call', ...) — ví dụ pollMediaJob — mất project_id
 * và đọc/ghi ở scope project mặc định.
 *
 * Guard này:
 * - kiểm tra lại bridge.call trước mỗi request (ensureProjectBridgeGuard)
 * - tự patch lại nếu hàm hiện tại không mang cờ guard
 * - poll định kỳ 1.5s để bắt trường hợp bridge bị thay giữa hai request
 * - GHI ĐÈ project_id cho mọi endpoint /ai/* (trừ endpoint list projects)
 *
 * Không import lib/api.js để tránh import cycle.
 */

import { getApiProjectId, PROJECT_LIST_ENDPOINTS } from './projectState.js';

const GUARD_FLAG = '__gommoProjectGuard';
const ORIGINAL_KEY = '__gommoProjectGuardOriginal';
const TIMER_KEY = '__gommoProjectGuardTimer';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readEndpoint(payload) {
  if (!isPlainObject(payload)) return '';
  return String(payload.endpoint ?? payload.url ?? '');
}

function readMethod(payload) {
  if (!isPlainObject(payload)) return 'GET';
  return String(payload.method || 'GET').toUpperCase();
}

/** Chỉ inject cho /ai/* và không inject vào chính endpoint list projects. */
function shouldInject(endpoint) {
  const ep = String(endpoint || '');
  if (!ep.startsWith('/ai/')) return false;
  return !PROJECT_LIST_ENDPOINTS.some((x) => ep === x || ep.startsWith(`${x}?`));
}

/**
 * Endpoint tạo/poll job — cần đối chiếu project_id GỬI ĐI vs project_id TRẢ VỀ.
 * Bao gồm gateway mới /ai/jobs/{type}/{model_id} và các endpoint create/poll cũ.
 */
const JOB_ENDPOINT_PREFIXES = [
  '/ai/jobs',
  '/ai/create-',
  '/ai/video',
  '/ai/image',
  '/ai/music',
  '/ai/tts',
];

function isJobEndpoint(endpoint) {
  const ep = String(endpoint || '');
  return JOB_ENDPOINT_PREFIXES.some((p) => ep.startsWith(p));
}

function recordDebug(endpoint, method, projectId) {
  const entry = {
    at: new Date().toISOString(),
    endpoint: String(endpoint || ''),
    method: String(method || ''),
    project_id: String(projectId || ''),
    source: 'bridgeGuard',
  };
  if (typeof window === 'undefined') return entry;
  const log = (window.__gommoProjectDebug = window.__gommoProjectDebug || []);
  log.push(entry);
  if (log.length > 50) log.shift();
  window.__gommoProjectLastSent = entry;
  return entry;
}

/** project_id backend trả về (create hoặc poll) — dò nhiều vị trí có thể chứa. */
export function readReturnedProjectId(res) {
  if (!res || typeof res !== 'object') return '';
  const nodes = [
    res,
    res.data,
    Array.isArray(res.data) ? res.data[0] : null,
    res.raw,
    res.data?.raw,
    res.videoInfo,
    Array.isArray(res.videoInfo) ? res.videoInfo[0] : null,
    res.imageInfo,
    Array.isArray(res.imageInfo) ? res.imageInfo[0] : null,
    res.data?.videoInfo,
    Array.isArray(res.data?.videoInfo) ? res.data.videoInfo[0] : null,
    res.data?.imageInfo,
    Array.isArray(res.data?.imageInfo) ? res.data.imageInfo[0] : null,
    res.requestInfo,
    res.data?.requestInfo,
  ];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const v = String(node.project_id ?? node.projectId ?? node.project?.id ?? '').trim();
    if (v) return v;
  }
  return '';
}

/**
 * Đọc project_id trong response và cảnh báo khi khác project_id đã gửi.
 * Xác nhận job thực sự bị tạo sai project (không phải lỗi hiển thị).
 */
function auditResponse(result, entry) {
  if (!result || typeof result.then !== 'function' || !isJobEndpoint(entry.endpoint)) {
    return result;
  }
  const push = (record) => {
    if (typeof window === 'undefined') return;
    const log = (window.__gommoProjectAudit = window.__gommoProjectAudit || []);
    log.push(record);
    if (log.length > 50) log.shift();
  };
  return result.then(
    (res) => {
      const returned = readReturnedProjectId(res);
      push({ ...entry, returned_project_id: returned });
      if (returned && returned !== entry.project_id) {
        console.error(
          `[project] MISMATCH ${entry.method} ${entry.endpoint} — gửi project_id="${entry.project_id}" nhưng backend trả "${returned}"`,
        );
      } else if (!returned) {
        console.info(
          `[project] ${entry.method} ${entry.endpoint} — response không chứa project_id (gửi "${entry.project_id}")`,
        );
      }
      return res;
    },
    (error) => {
      push({ ...entry, returned_project_id: '', error: error?.message || String(error) });
      throw error;
    },
  );
}

/** Log audit đầy đủ: project_id gửi đi + project_id backend trả về. */
export function getProjectAuditLog() {
  return typeof window !== 'undefined' ? window.__gommoProjectAudit || [] : [];
}

if (typeof window !== 'undefined') {
  // Gõ gommoProjectReport() trong console để xem toàn bộ chuỗi project_id.
  window.gommoProjectReport = () => ({
    active: getApiProjectId(),
    lastSent: window.__gommoProjectLastSent || null,
    sent: window.__gommoProjectDebug || [],
    audit: window.__gommoProjectAudit || [],
  });
}

/**
 * Trả payload mới có project_id (không mutate payload gốc).
 * GET → params; còn lại → data (axios-style) hoặc body (canonical).
 */
function injectProject(payload, projectId) {
  if (!isPlainObject(payload)) return payload;
  const next = { ...payload };
  if (readMethod(payload) === 'GET') {
    next.params = { ...(isPlainObject(payload.params) ? payload.params : {}), project_id: projectId };
    return next;
  }
  if (isPlainObject(payload.data) || (payload.data != null && !isPlainObject(payload.body))) {
    if (isPlainObject(payload.data)) {
      next.data = { ...payload.data, project_id: projectId };
      return next;
    }
    // data không phải plain object (FormData…) → không can thiệp, thêm vào params.
    next.params = { ...(isPlainObject(payload.params) ? payload.params : {}), project_id: projectId };
    return next;
  }
  if (payload.body != null && !isPlainObject(payload.body)) {
    next.params = { ...(isPlainObject(payload.params) ? payload.params : {}), project_id: projectId };
    return next;
  }
  next.body = { ...(isPlainObject(payload.body) ? payload.body : {}), project_id: projectId };
  return next;
}

/**
 * Đảm bảo bridge.call hiện tại đã được patch. Gọi trước mỗi request là an toàn
 * (idempotent, chỉ patch lại khi hàm bị thay).
 */
export function ensureProjectBridgeGuard() {
  if (typeof window === 'undefined') return false;
  const bridge = window.gommoMiniApp;
  if (!bridge || typeof bridge.call !== 'function') return false;
  if (bridge.call[GUARD_FLAG]) return true;

  const original = bridge.call.bind(bridge);

  const patched = function patchedCall(action, payload, ...rest) {
    try {
      if (String(action || '') === 'api.call') {
        const endpoint = readEndpoint(payload);
        const method = readMethod(payload);
        // Đọc project_id TẠI THỜI ĐIỂM GỬI (không closure) → không bị stale.
        const projectId = getApiProjectId();
        if (projectId && shouldInject(endpoint)) {
          let nextPayload = injectProject(payload, projectId);
          // Gateway job (/ai/jobs/{type}/{model_id}) có thể parse form-urlencoded hoặc JSON
          // khác nhau → gửi song song ở params để project_id không bị mất khi body sai
          // content-type.
          if (method !== 'GET' && isJobEndpoint(endpoint)) {
            nextPayload = {
              ...nextPayload,
              params: {
                ...(isPlainObject(nextPayload.params) ? nextPayload.params : {}),
                project_id: projectId,
              },
            };
          }
          const entry = recordDebug(endpoint, method, projectId);
          if (isJobEndpoint(endpoint)) {
            console.info(`[project] ${method} ${endpoint} → project_id="${projectId}"`);
          }
          return auditResponse(original(action, nextPayload, ...rest), entry);
        }
        if (!projectId && shouldInject(endpoint)) {
          console.warn(
            `[project] ${endpoint} gọi khi chưa có project_id → request sẽ chạy ở project mặc định`,
          );
        }
      }
    } catch (error) {
      console.warn('[project] bridge guard lỗi, gọi bridge nguyên bản', error);
    }
    return original(action, payload, ...rest);
  };

  patched[GUARD_FLAG] = true;
  patched[ORIGINAL_KEY] = original;
  bridge.call = patched;
  return true;
}

/** Bật kiểm tra định kỳ để bắt trường hợp parent thay bridge giữa hai request. */
export function startProjectBridgeGuard(intervalMs = 1500) {
  if (typeof window === 'undefined') return () => {};
  ensureProjectBridgeGuard();
  if (window[TIMER_KEY]) return () => clearInterval(window[TIMER_KEY]);
  window[TIMER_KEY] = setInterval(ensureProjectBridgeGuard, Math.max(500, Number(intervalMs) || 1500));
  return () => {
    clearInterval(window[TIMER_KEY]);
    window[TIMER_KEY] = null;
  };
}

/** Trạng thái guard để UI hiển thị (bridge có sẵn chưa, đã patch chưa). */
export function getProjectBridgeStatus() {
  if (typeof window === 'undefined') return { bridge: false, guarded: false };
  const bridge = window.gommoMiniApp;
  const hasBridge = !!bridge && typeof bridge.call === 'function';
  return {
    bridge: hasBridge,
    guarded: hasBridge && bridge.call[GUARD_FLAG] === true,
  };
}

// Tự bật ngay khi module được load (bridge có thể sẵn sàng muộn → interval xử lý).
if (typeof window !== 'undefined') {
  startProjectBridgeGuard();
}

export default {
  ensureProjectBridgeGuard,
  startProjectBridgeGuard,
  getProjectBridgeStatus,
};