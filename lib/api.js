/** Gommo bridge API wrapper — chỉ gommoApi + toItems (tự gắn project_id). */

import { getApiProjectId, PROJECT_LIST_ENDPOINTS } from './projectState.js';
import { ensureProjectBridgeGuard } from './projectBridge.js';

export function toItems(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Ghi lại project_id thực tế gửi lên (xem window.__gommoProjectDebug). */
function recordProjectDebug(endpoint, method, payload, source = 'gommoApi') {
  const sent =
    (isPlainObject(payload?.body) ? payload.body.project_id : undefined) ??
    (isPlainObject(payload?.params) ? payload.params.project_id : undefined) ??
    '';
  const entry = {
    at: new Date().toISOString(),
    endpoint: String(endpoint || ''),
    method: String(method || ''),
    project_id: sent || '',
    source,
  };
  if (typeof window !== 'undefined') {
    const log = (window.__gommoProjectDebug = window.__gommoProjectDebug || []);
    log.push(entry);
    if (log.length > 50) log.shift();
  }
  if (typeof window !== 'undefined') {
    window.__gommoProjectLastSent = entry;
  }
  if (entry.endpoint.startsWith('/ai/create-video') && !sent) {
    console.warn(
      '[project] /ai/create-video gửi KHÔNG có project_id → video sẽ vào project mặc định của tài khoản',
    );
  } else if (entry.endpoint.startsWith('/ai/create-video')) {
    console.info(`[project] /ai/create-video gửi project_id="${sent}" (source=${source})`);
  }
  return entry;
}

export function getProjectDebugLog() {
  return typeof window !== 'undefined' ? window.__gommoProjectDebug || [] : [];
}

const PROJECT_ERROR_HINTS = ['project_id', 'project', 'dự án', 'du an'];

/** Message lỗi có liên quan tới project? (chỉ dùng để log, không retry / không đổi field) */
export function isProjectRelatedError(message) {
  const msg = String(message || '').toLowerCase();
  if (!msg) return false;
  return PROJECT_ERROR_HINTS.some((k) => msg.includes(k));
}

function readResponseMessage(res) {
  if (!res || typeof res !== 'object') return '';
  const nodes = [res, res.data, res.error, res.data?.error];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const msg = node.message ?? node.error_message ?? node.msg ?? node.error;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  return '';
}

/**
 * Khi /ai/create-video trả lỗi liên quan project → log rõ project_id ĐÃ GỬI để debug.
 * Không tự retry, không thử tên field khác.
 */
export function watchProjectError(promise, endpoint, projectId) {
  const ep = String(endpoint || '');
  if (!ep.startsWith('/ai/create-video') || !promise || typeof promise.then !== 'function') {
    return promise;
  }
  return promise.then(
    (res) => {
      const message = readResponseMessage(res);
      if (message && isProjectRelatedError(message)) {
        console.error(
          `[project] /ai/create-video lỗi liên quan project — project_id đã gửi="${projectId || ''}" | message="${message}"`,
        );
      }
      return res;
    },
    (error) => {
      const message = error?.message || String(error);
      if (isProjectRelatedError(message)) {
        console.error(
          `[project] /ai/create-video thất bại (lỗi project) — project_id đã gửi="${projectId || ''}" | message="${message}"`,
        );
      }
      throw error;
    },
  );
}

function shouldInjectProject(endpoint) {
  const ep = String(endpoint || '');
  if (!ep.startsWith('/ai/')) return false;
  // Cùng luật với projectBridge.shouldInject (khớp cả dạng có query string)
  // → hai tầng inject không còn lệch nhau.
  return !PROJECT_LIST_ENDPOINTS.some((x) => ep === x || ep.startsWith(`${x}?`));
}

/** Gắn project_id vào mọi request /ai/* — body cho POST/PUT, params cho GET.
 *  Ghi đè giá trị cũ (stale) trong body: project đang chọn là nguồn duy nhất. */
export function withProjectPayload(endpoint, method, params, body) {
  // Re-verify bridge guard trước mỗi request: parent có thể gán lại window.gommoMiniApp
  // sau lần patch đầu tiên → các call trực tiếp (pollMediaJob) mất project_id.
  ensureProjectBridgeGuard();
  const projectId = getApiProjectId();
  if (!projectId || !shouldInjectProject(endpoint)) return { params, body };
  // ROOT CAUSE LỖI 1: nhánh POST/PUT bên dưới chỉ inject khi project_id == null,
  // nên payload mang sẵn giá trị cũ ('default' hoặc project trước đó) KHÔNG bị ghi đè.
  // Xoá key stale trước → mọi /ai/* (GET + POST) đều dùng project đang chọn làm nguồn duy nhất.
  if (isPlainObject(body) && body.project_id != null && String(body.project_id) !== projectId) {
    const nextBody = { ...body };
    delete nextBody.project_id;
    body = nextBody;
  }
  if (
    isPlainObject(params) &&
    params.project_id != null &&
    String(params.project_id) !== projectId
  ) {
    const nextParams = { ...params };
    delete nextParams.project_id;
    params = nextParams;
  }
  // ROOT CAUSE LỖI 1: nhánh POST/PUT bên dưới chỉ inject khi project_id == null,
  // nên payload mang sẵn giá trị cũ ('default' hoặc project trước đó) KHÔNG bị ghi đè.
  // Xoá key stale trước → mọi /ai/* (GET + POST) đều dùng project đang chọn làm nguồn duy nhất.
  if (isPlainObject(body) && body.project_id != null && String(body.project_id) !== projectId) {
    const nextBody = { ...body };
    delete nextBody.project_id;
    body = nextBody;
  }
  if (
    isPlainObject(params) &&
    params.project_id != null &&
    String(params.project_id) !== projectId
  ) {
    const nextParams = { ...params };
    delete nextParams.project_id;
    params = nextParams;
  }
  const isGet = String(method || 'GET').toUpperCase() === 'GET';
  if (isGet) {
    // Ghi đè cả khi params đã có project_id: project đang chọn là nguồn duy nhất.
    return {
      params: { ...(isPlainObject(params) ? params : {}), project_id: projectId },
      body,
    };
  }
  if (isPlainObject(body)) {
    if (body.project_id == null) return { params, body: { ...body, project_id: projectId } };
    return { params, body };
  }
  if (body == null) return { params, body: { project_id: projectId } };
  return { params, body };
}

/**
 * Patch bridge `call` một lần: mọi `api.call` tới /ai/* đều được gắn project_id,
 * kể cả nơi gọi window.gommoMiniApp.call trực tiếp (pollMediaJob) — đây là chỗ
 * trước đây làm poll chạy ở scope project mặc định.
 */
let interceptorInstalled = false;

export function installProjectApiInterceptor() {
  if (interceptorInstalled) return true;
  const bridge = typeof window !== 'undefined' ? window.gommoMiniApp : null;
  if (!bridge || typeof bridge.call !== 'function') return false;
  if (bridge.__projectInterceptor) {
    interceptorInstalled = true;
    return true;
  }
  const original = bridge.call.bind(bridge);
  bridge.call = function patchedBridgeCall(action, input) {
    if (action !== 'api.call' || !isPlainObject(input)) return original(action, input);
    const endpoint = input.endpoint || input.url || '';
    const method = String(input.method || 'GET');
    const projectId = getApiProjectId();
    if (!projectId || !shouldInjectProject(endpoint)) return original(action, input);
    const next = { ...input };
    if (method.toUpperCase() === 'GET') {
      const useQuery = !isPlainObject(next.params) && isPlainObject(next.query);
      const target = useQuery ? next.query : isPlainObject(next.params) ? next.params : {};
      if (target.project_id == null) {
        const merged = { ...target, project_id: projectId };
        if (useQuery) next.query = merged;
        else next.params = merged;
      }
    } else if (isPlainObject(next.body)) {
      if (next.body.project_id == null) next.body = { ...next.body, project_id: projectId };
    } else if (isPlainObject(next.data)) {
      if (next.data.project_id == null) next.data = { ...next.data, project_id: projectId };
    } else {
      next.body = { project_id: projectId };
    }
    recordProjectDebug(endpoint, method, { params: next.params, body: next.body }, 'interceptor');
    const sentProjectId =
      (isPlainObject(next.body) ? next.body.project_id : undefined) ??
      (isPlainObject(next.params) ? next.params.project_id : undefined) ??
      projectId;
    return watchProjectError(original(action, next), endpoint, sentProjectId);
  };
  bridge.__projectInterceptor = true;
  interceptorInstalled = true;
  return true;
}

// Bridge có thể sẵn sàng muộn → thử lại tới khi patch được (tối đa ~30s).
if (typeof window !== 'undefined' && !installProjectApiInterceptor()) {
  let tries = 0;
  const retryTimer = setInterval(() => {
    tries += 1;
    if (installProjectApiInterceptor() || tries > 150) clearInterval(retryTimer);
  }, 200);
}

export async function gommoApi(endpoint, { method = 'GET', params = {}, body = {} } = {}) {
  installProjectApiInterceptor();
  if (!window.gommoMiniApp?.call) {
    throw new Error('Gommo bridge chưa sẵn sàng — preview iframe phải load trước khi gọi API');
  }
  const payload = withProjectPayload(endpoint, method, params, body);
  recordProjectDebug(endpoint, method, payload);
  return await window.gommoMiniApp.call('api.call', {
    endpoint,
    method,
    params: payload.params,
    body: payload.body,
  });
}

export async function bridgeCall(action, input = {}) {
  installProjectApiInterceptor();
  if (!window.gommoMiniApp?.call) {
    throw new Error('Gommo bridge chưa sẵn sàng');
  }
  return await window.gommoMiniApp.call(action, input);
}