/** Project đang chọn — state cấp module để mọi request api.call dùng chung. */

export const DEFAULT_PROJECT_ID = 'default';

/**
 * Endpoint List Projects chính thức theo tài liệu:
 * POST https://api.gommo.net/api/apps/go-mmo/ai/projects
 * Body (application/x-www-form-urlencoded): access_token, domain — bridge tự gắn.
 */
export const PROJECT_LIST_ENDPOINT = '/ai/projects';

/** Endpoint dùng để lấy danh sách project — không tự inject project_id vào chính nó. */
export const PROJECT_LIST_ENDPOINTS = [PROJECT_LIST_ENDPOINT];

/** id khác 'default'. */
export function isRealProjectId(id) {
  const v = String(id || '').trim();
  return !!v && v !== DEFAULT_PROJECT_ID && v !== 'null' && v !== 'undefined';
}

/**
 * id gửi được lên backend. API List Projects trả 'default' là project THẬT
 * → 'default' hợp lệ và phải được gửi trong create-video.
 */
export function isValidProjectId(id) {
  const v = String(id || '').trim();
  return !!v && v !== 'null' && v !== 'undefined';
}

/**
 * @deprecated Chỉ giữ để tương thích import cũ.
 * project_id luôn lấy từ project đang chọn trong danh sách API List Projects,
 * không suy đoán từ mini app context / query string.
 */
export function getHostProjectId() {
  return '';
}

/**
 * State singleton trên window: nếu module bị đánh giá nhiều lần (bundle scope khác),
 * mọi bản copy vẫn đọc/ghi cùng một nơi.
 */
const STORE_KEY = '__gommoProjectState';
const store = (() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  if (!root[STORE_KEY]) {
    root[STORE_KEY] = {
      // Chưa resolve từ API List Projects → rỗng.
      // KHÔNG khởi tạo bằng sentinel 'default': nếu backend không có project id 'default',
      // mọi create-video gửi sớm sẽ rơi về project mặc định của tài khoản.
      activeProjectId: '',
      resolved: false,
      listeners: new Set(),
    };
  }
  return root[STORE_KEY];
})();

const listeners = store.listeners;

// Cờ "user đã tự bấm chọn project" — nằm trong store singleton để mọi bundle copy dùng chung.
// Đây là chốt chặn khiến load() / hydrate settings KHÔNG thể reset về 'default'.
if (typeof store.userChoiceId !== 'string') store.userChoiceId = '';

export function getActiveProjectId() {
  return store.activeProjectId || '';
}

/** id project do user tự bấm chọn trong session này (rỗng nếu chưa từng bấm). */
export function getUserChoiceProjectId() {
  return store.userChoiceId || '';
}

/** Xoá cờ user choice (dùng khi project đã chọn không còn tồn tại). */
export function clearUserChoiceProjectId() {
  store.userChoiceId = '';
}

/**
 * Registry raw row của project (key = id gửi API mặc định, thường là id_base).
 * Cần vì backend có thể resolve project theo DẠNG id khác (id nội bộ, code, slug…):
 * nếu gửi sai dạng, backend im lặng ghi job vào project mặc định.
 */
if (!store.rows || typeof store.rows !== 'object') store.rows = {};
/** Field id đã chốt để gửi lên backend ('' = dùng id mặc định của project). */
if (typeof store.idField !== 'string') store.idField = '';

/** Các field có thể chứa id project trong row API (thứ tự hiển thị). */
export const PROJECT_ID_FIELDS = [
  'id_base',
  'idBase',
  'project_id',
  'projectId',
  'project_id_base',
  'id',
  '_id',
  'code',
  'slug',
  'uuid',
  'key',
];

/** Danh sách { field, value } các dạng id CÓ THẬT trong row. */
export function collectProjectIdCandidates(row) {
  if (!row || typeof row !== 'object') return [];
  const out = [];
  const seen = new Set();
  PROJECT_ID_FIELDS.forEach((field) => {
    const raw = row[field];
    if (raw == null || typeof raw === 'object') return;
    const value = String(raw).trim();
    if (!value) return;
    const key = `${field}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ field, value });
  });
  return out;
}

/** Lưu raw row của mọi project vừa load để tra cứu dạng id khi gửi request. */
export function registerProjectRows(items) {
  (Array.isArray(items) ? items : []).forEach((p) => {
    const key = String(p?.id || '').trim();
    if (!key) return;
    store.rows[key] = p?.raw && typeof p.raw === 'object' ? p.raw : { id: key };
  });
  return store.rows;
}

/** Raw row theo id gửi API mặc định. */
export function getProjectRow(id) {
  const key = String(id || '').trim();
  return key && store.rows[key] ? store.rows[key] : null;
}

export function getActiveProjectRow() {
  return getProjectRow(getActiveProjectId());
}

export function getActiveProjectCandidates() {
  return collectProjectIdCandidates(getActiveProjectRow());
}

export function getProjectIdField() {
  return store.idField || '';
}

/**
 * Chốt dạng id gửi lên backend — dùng khi backend KHÔNG resolve theo id_base
 * (video vẫn rơi vào project mặc định dù đã gửi project_id).
 * Mọi tầng inject (gommoApi, bridge guard, library query) đều đọc getApiProjectId
 * nên chỉ cần đổi ở đây là toàn bộ request đổi theo.
 */
export function setProjectIdField(field) {
  const next = String(field || '').trim();
  if (next === store.idField) return store.idField;
  store.idField = next;
  console.info(
    `[project] id field="${next || '(mặc định)'}" → project_id gửi lên="${getApiProjectId()}"`,
  );
  listeners.forEach((fn) => {
    try {
      fn(getActiveProjectId());
    } catch (error) {
      console.warn('[project] listener failed', error);
    }
  });
  return store.idField;
}

/**
 * project_id gửi lên API — đúng id của project đang được chọn (kể cả 'default',
 * vì đây là id thật do API List Projects trả về). Rỗng nếu chưa chọn được project.
 */
export function getApiProjectId() {
  const id = getActiveProjectId();
  if (!isValidProjectId(id)) return '';
  // Nếu đã chốt một dạng id khác (backend không nhận id_base) → gửi giá trị của field đó.
  const field = getProjectIdField();
  if (field) {
    const row = getProjectRow(id);
    const v = row ? String(row[field] ?? '').trim() : '';
    if (v) return v;
  }
  return id;
}

function applyProjectId(next) {
  if (next === store.activeProjectId) return store.activeProjectId;
  store.activeProjectId = next;
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch (error) {
      console.warn('[project] listener failed', error);
    }
  });
  return store.activeProjectId;
}

/**
 * User tự bấm chọn project (ProjectPicker.handleChange) → ghi nhận sticky.
 * Mọi lần load lại danh sách project / hydrate settings sau đó phải TÔN TRỌNG giá trị này,
 * nếu không job sẽ bị tạo trong project 'default' dù UI đang hiển thị project khác.
 */
export function setActiveProjectId(id) {
  const next = String(id || '').trim();
  if (next) {
    store.userChoiceId = next;
    console.info(`[project] user chọn project_id="${next}" (sticky)`);
  }
  return applyProjectId(next);
}

/**
 * Gán project_id do hệ thống resolve (API List Projects / settings đã lưu).
 * KHÔNG đánh dấu là lựa chọn của user → không ghi đè cờ sticky.
 */
export function setResolvedProjectId(id) {
  return applyProjectId(String(id || '').trim());
}

/**
 * Đánh dấu project_id hiện tại đến từ API List Projects (id thật), không phải giá trị đoán.
 * Engine chỉ tạo video khi cờ này bật.
 */
export function markProjectResolved(resolved = true) {
  store.resolved = resolved !== false;
  return store.resolved;
}

export function isProjectResolved() {
  return store.resolved === true && isValidProjectId(store.activeProjectId);
}

export function subscribeProject(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export default {
  DEFAULT_PROJECT_ID,
  PROJECT_LIST_ENDPOINT,
  PROJECT_LIST_ENDPOINTS,
  isRealProjectId,
  isValidProjectId,
  getHostProjectId,
  getActiveProjectId,
  getApiProjectId,
  setActiveProjectId,
  setResolvedProjectId,
  getUserChoiceProjectId,
  clearUserChoiceProjectId,
  markProjectResolved,
  isProjectResolved,
  subscribeProject,
};