/** Upload / pick media qua bridge + helper file→base64. */

import { bridgeCall } from './api.js';
import { getApiProjectId } from './projectState.js';

/**
 * Bridge action media.upload_* / album.* KHÔNG đi qua api.call → guard không inject
 * project_id. Gắn tường minh ở đây để upload nằm đúng project đang chọn.
 */
function withProject(input) {
  const projectId = getApiProjectId();
  if (!projectId) {
    console.warn('[project] upload/album gọi khi chưa có project_id → dùng project mặc định');
    return input;
  }
  return { ...input, project_id: projectId, projectId };
}

export async function fileToBase64(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pickUrl(res) {
  return (
    res?.url ||
    res?.file_url ||
    res?.items?.[0]?.url ||
    res?.data?.url ||
    res?.result?.[0]?.url ||
    ''
  );
}

export async function uploadImageFile(file) {
  const base64 = await fileToBase64(file);
  const payload = withProject({
    base64,
    pick: false,
    filename: file.name || 'image.jpg',
    mime: file.type || 'image/jpeg',
  });
  console.info(`[project] media.upload_image project_id="${payload.project_id || ''}"`);
  const res = await bridgeCall('media.upload_image', payload);
  const url = pickUrl(res);
  if (!url) throw new Error('Upload ảnh không thành công');
  return { url, name: file.name || 'image.jpg' };
}

export async function uploadVideoFile(file) {
  let seconds = 0;
  try {
    seconds = await probeFileDuration(file);
  } catch (error) {
    seconds = 0;
  }
  const base64 = await fileToBase64(file);
  const payload = withProject({
    base64,
    pick: false,
    filename: file.name || 'clip.mp4',
    mime: file.type || 'video/mp4',
  });
  console.info(`[project] media.upload_video project_id="${payload.project_id || ''}"`);
  const res = await bridgeCall('media.upload_video', payload);
  const url = pickUrl(res);
  if (!url) throw new Error('Upload video không thành công');
  return { url, name: file.name || 'clip.mp4', seconds };
}

export async function pickFromAlbum(kind, multiple) {
  const res = await bridgeCall(
    'album.open_picker',
    withProject({
      mediaTypes: [kind],
      multiple: !!multiple,
    }),
  );
  const items = Array.isArray(res?.items) ? res.items : res?.url ? [res] : [];
  return items
    .map((it) => ({ url: it.url || it.download_url || '', name: it.name || '' }))
    .filter((it) => it.url);
}

export async function openLightbox(url, type) {
  try {
    await bridgeCall('media.open_lightbox', { url, type: type || 'video', items: [{ url, type }] });
  } catch (error) {
    window.open(url, '_blank');
  }
}

/** Mở lightbox với toàn bộ danh sách media + vị trí bắt đầu. */
export async function openMediaLightbox(items, index = 0, type = 'image') {
  const list = (Array.isArray(items) ? items : [])
    .map((it) => (typeof it === 'string' ? { url: it, type } : { url: it?.url || '', type: it?.type || type }))
    .filter((it) => it.url);
  if (list.length === 0) return;
  const start = Math.max(0, Math.min(Number(index) || 0, list.length - 1));
  try {
    await bridgeCall('media.open_lightbox', {
      url: list[start].url,
      type: list[start].type || type,
      items: list,
      index: start,
    });
  } catch (error) {
    window.open(list[start].url, '_blank');
  }
}

/** Đo thời lượng video từ URL bằng metadata (không tải toàn bộ file). */
export function probeVideoDuration(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(0);
      return;
    }
    const el = document.createElement('video');
    let timer = null;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      el.onloadedmetadata = null;
      el.onerror = null;
      try {
        el.removeAttribute('src');
        el.load();
      } catch (error) {
        /* noop */
      }
      const n = Number(value);
      resolve(Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0);
    };
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => finish(el.duration);
    el.onerror = () => finish(0);
    timer = setTimeout(() => finish(0), 15000);
    el.src = src;
  });
}

export async function probeFileDuration(file) {
  if (!file) return 0;
  const objUrl = URL.createObjectURL(file);
  try {
    return await probeVideoDuration(objUrl);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  }
}

export async function sendTelegram({ text, videos = [], images = [] }) {
  return bridgeCall('notification.send', {
    text,
    images,
    videos,
    send_push: false,
    send_telegram: true,
  });
}