/**
 * Chẩn đoán DẠNG project_id mà backend thật sự nhận.
 *
 * Bối cảnh: app luôn gửi id_base làm project_id. Nếu backend resolve project theo
 * field khác (id nội bộ, code, slug…), request vẫn 200 nhưng job bị ghi vào project
 * mặc định — đúng hiện tượng "video chỉ vào dự án mặc định".
 *
 * Cách kiểm chứng KHÔNG tốn credit: gọi endpoint LIST video với từng dạng id.
 * Dạng nào backend hiểu → trả về đúng danh sách của project đó.
 * Probe chạy bằng cách tạm chốt setProjectIdField(field) rồi gọi gommoApi,
 * nên nó đi qua đúng mọi tầng inject (gommoApi + bridge guard) như lúc tạo job.
 */

import { gommoApi, toItems } from './api.js';
import {
  getActiveProjectId,
  getActiveProjectCandidates,
  getApiProjectId,
  getProjectIdField,
  setProjectIdField,
} from './projectState.js';
import { normalizeLibraryVideo } from './videoLibrary.js';

const PROBE_ENDPOINTS = [
  { endpoint: '/ai/videos', method: 'POST', extra: {} },
  { endpoint: '/ai/jobs', method: 'POST', extra: { media: 'video', type: 'video' } },
];

async function probeCurrentField(expectedValue) {
  let lastError = '';
  for (const cfg of PROBE_ENDPOINTS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await gommoApi(cfg.endpoint, {
        method: cfg.method,
        // KHÔNG gửi project_id tường minh: để tầng inject tự gắn → đo đúng hành vi thật.
        body: { ...cfg.extra, page: 1, limit: 5 },
      });
      const items = toItems(res).map(normalizeLibraryVideo).filter(Boolean);
      const matched = items.filter(
        (v) => String(v.projectId || '') === String(expectedValue || ''),
      ).length;
      return {
        endpoint: cfg.endpoint,
        count: items.length,
        matched,
        returnedProjectIds: Array.from(
          new Set(items.map((v) => String(v.projectId || '')).filter(Boolean)),
        ),
        error: '',
      };
    } catch (error) {
      lastError = error?.message || String(error);
    }
  }
  return { endpoint: '', count: 0, matched: 0, returnedProjectIds: [], error: lastError };
}

/**
 * Thử lần lượt mọi dạng id của project đang chọn.
 * Trả { projectId, sentNow, results:[{ field, value, endpoint, count, matched, error }] }
 * — không throw, không đổi state sau khi chạy (khôi phục field ban đầu).
 */
export async function probeProjectIdShapes() {
  const projectId = getActiveProjectId();
  const previousField = getProjectIdField();
  const candidates = getActiveProjectCandidates();

  if (!projectId) {
    return {
      projectId: '',
      sentNow: '',
      results: [],
      error: 'Chưa chọn project — mở panel "0 · Project" và chọn project trước.',
    };
  }
  if (candidates.length === 0) {
    return {
      projectId,
      sentNow: getApiProjectId(),
      results: [],
      error:
        'Không đọc được raw row của project (bấm "Tải lại danh sách" ở panel Project rồi thử lại).',
    };
  }

  const results = [];
  try {
    for (const c of candidates) {
      setProjectIdField(c.field);
      // eslint-disable-next-line no-await-in-loop
      const out = await probeCurrentField(c.value);
      results.push({ field: c.field, value: c.value, ...out });
    }
  } finally {
    setProjectIdField(previousField);
  }

  return { projectId, sentNow: getApiProjectId(), results, error: '' };
}

export default { probeProjectIdShapes };