/**
 * List Projects + normalize.
 * Endpoint chính thức: POST https://api.gommo.net/api/apps/go-mmo/ai/projects
 * (bridge path '/ai/projects'), body access_token + domain do bridge tự gắn.
 * Response: danh sách project { id, name } — 'default' là project thật nếu API trả về.
 *
 * QUAN TRỌNG: row gốc được GIỮ LẠI (p.raw) và đăng ký vào projectState
 * (registerProjectRows) vì backend có thể resolve project theo dạng id khác id_base.
 */

import { gommoApi, toItems } from './api.js';
import {
  DEFAULT_PROJECT_ID,
  PROJECT_LIST_ENDPOINT,
  registerProjectRows,
  collectProjectIdCandidates,
} from './projectState.js';

export function normalizeProject(row) {
  if (row == null) return null;
  if (typeof row === 'string') {
    const id = row.trim();
    return id
      ? { id, name: id, apiId: id, rawId: id, raw: { id }, candidates: [{ field: 'id', value: id }] }
      : null;
  }
  if (typeof row !== 'object') return null;
  // Pattern Gommo: id_base là id ỔN ĐỊNH dùng cho request; `id` nội bộ (số) thường KHÔNG gửi lên API.
  // Ưu tiên id_base → project_id → id → …
  const apiId = String(
    row.id_base ??
      row.idBase ??
      row.project_id_base ??
      row.project_id ??
      row.projectId ??
      row.id ??
      row._id ??
      row.code ??
      '',
  ).trim();
  if (!apiId) return null;
  const rawId = String(row.id ?? row._id ?? apiId).trim();
  const name = String(row.name ?? row.title ?? row.project_name ?? row.label ?? apiId).trim();
  // id = giá trị gửi lên API (id_base khi có) → mọi nơi dùng p.id đều đúng.
  return {
    id: apiId,
    apiId,
    rawId,
    name: name || apiId,
    raw: row,
    // mọi dạng id ứng viên → dùng để chẩn đoán dạng backend thật sự nhận
    candidates: collectProjectIdCandidates(row),
  };
}

export function normalizeProjectList(raw) {
  const list = (Array.isArray(raw) ? raw : []).map(normalizeProject).filter(Boolean);
  const seen = new Set();
  return list.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/** Tìm project theo id gửi API (id_base) hoặc theo id nội bộ (rawId). */
export function findProject(list, id) {
  const items = Array.isArray(list) && list.length && list[0]?.apiId !== undefined
    ? list
    : normalizeProjectList(list);
  const v = String(id || '').trim();
  if (!v) return null;
  return (
    items.find((p) => p.id === v) ||
    items.find((p) => String(p.rawId || '') === v) ||
    items.find((p) => (p.candidates || []).some((c) => c.value === v)) ||
    null
  );
}

/**
 * Chọn project:
 * 1) giữ current nếu còn trong danh sách (khớp id_base HOẶC id nội bộ đã lưu từ bản cũ)
 * 2) project có id = 'default' nếu tồn tại
 * 3) project đầu tiên trong danh sách
 * Không tạo project ảo, không suy đoán id khi danh sách rỗng.
 * KHÔNG fallback ngầm sang 'default' khi list rỗng — trả current để caller tự xử lý.
 */
export function resolveProjectId(list, current, options) {
  const items = normalizeProjectList(list);
  const cur = String(current || '').trim();
  if (items.length === 0) return cur;
  const matched = findProject(items, cur);
  if (matched) return matched.id;
  // strict: KHÔNG âm thầm rơi về 'default' khi giá trị đang có không còn trong danh sách.
  // Trả '' để caller báo rõ cho user — đây là nguồn gốc "job vào project default" trước đây.
  if (options?.strict && cur) return '';
  if (items.some((p) => p.id === DEFAULT_PROJECT_ID)) return DEFAULT_PROJECT_ID;
  return items[0].id;
}

/**
 * Không throw: trả { items, error, endpoint } để UI hiển thị lỗi thật của API list.
 * Đồng thời đăng ký raw row vào projectState để tra cứu dạng id khi gửi request.
 */
export async function loadProjectsDetailed() {
  try {
    const res = await gommoApi(PROJECT_LIST_ENDPOINT, { method: 'POST', body: {} });
    const items = normalizeProjectList(toItems(res));
    registerProjectRows(items);
    return {
      items,
      error: '',
      endpoint: PROJECT_LIST_ENDPOINT,
    };
  } catch (error) {
    return {
      items: [],
      error: error?.message || String(error),
      endpoint: PROJECT_LIST_ENDPOINT,
    };
  }
}

export async function loadProjects() {
  const { items } = await loadProjectsDetailed();
  return items;
}

export default {
  loadProjects,
  loadProjectsDetailed,
  resolveProjectId,
  findProject,
  normalizeProject,
  normalizeProjectList,
};