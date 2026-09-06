/** Persist per-user app settings qua bridge app.settings (không localStorage). */

import { bridgeCall } from './api.js';

export async function loadSettings() {
  try {
    const res = await bridgeCall('app.settings.get', {});
    const value = res?.value && typeof res.value === 'object' ? res.value : {};
    return value;
  } catch (error) {
    console.warn('[settings] load failed', error);
    return {};
  }
}

export async function patchSettings(partial) {
  try {
    await bridgeCall('app.settings.patch', { value: partial });
    return true;
  } catch (error) {
    console.warn('[settings] patch failed', error);
    return false;
  }
}

/**
 * Patch settings nhưng LUÔN giữ projectId đang chọn.
 * Autosave snapshot (useStudio) từng ghi projectId='' khi store chưa resolve
 * → lần load kế tiếp savedId rỗng → rơi về project đầu/'default'.
 */
export async function patchSettingsKeepProject(partial, currentProjectId) {
  const next = { ...(partial || {}) };
  const keep = String(currentProjectId || '').trim();
  if (keep) next.projectId = keep;
  else delete next.projectId; // không ghi rỗng lên giá trị đã lưu
  return patchSettings(next);
}