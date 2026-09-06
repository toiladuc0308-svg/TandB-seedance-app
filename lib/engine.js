/** Engine tạo video: ghép ảnh nhân vật + ảnh thời trang + video ref → /ai/create-video. */

import { gommoApi } from './api.js';
import { getApiProjectId, getHostProjectId, isProjectResolved } from './projectState.js';
import { ensureProjectBridgeGuard } from './projectBridge.js';
import { buildCreateVideoBody } from './modelCatalog.js';
import { applyDurationFromSeconds, isAutoDurationMode } from './duration.js';
import { isAutoDurationEnabled } from './runtimeFlags.js';
import { parseMediaCreateResponse, pollMediaJob } from './mediaJobs.js';
import { sendTelegram } from './media.js';

/** Lấy project_id mà backend trả về trong response create (nhiều vị trí có thể chứa). */
function readReturnedProjectId(res) {
  if (!res || typeof res !== 'object') return '';
  const nodes = [
    res,
    res.data,
    res.videoInfo,
    Array.isArray(res.videoInfo) ? res.videoInfo[0] : null,
    res.data?.videoInfo,
    Array.isArray(res.data?.videoInfo) ? res.data.videoInfo[0] : null,
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

export function buildPairs({
  characterUrl,
  fashion,
  videos,
  maxVideos,
  randomFashion,
  randomVideo,
  usedFashion,
  usedVideo,
  fashionOnce,
  videoOnce,
}) {
  const fashionPool = fashion.filter((f) => !(fashionOnce && usedFashion.includes(f.url)));
  const videoPool = videos.filter((v) => !(videoOnce && usedVideo.includes(v.url)));
  if (videoPool.length === 0) {
    throw new Error('Không còn video khả dụng (kiểm tra khoá "dùng 1 lần")');
  }
  if (fashionPool.length === 0) {
    throw new Error('Không còn ảnh thời trang khả dụng (kiểm tra khoá "dùng 1 lần")');
  }

  const fList = randomFashion ? shuffle(fashionPool) : fashionPool;
  const vList = randomVideo ? shuffle(videoPool) : videoPool;
  const count = Math.max(1, Math.min(Number(maxVideos) || 1, vList.length));

  const pairs = [];
  for (let i = 0; i < count; i += 1) {
    pairs.push({
      index: i,
      characterUrl,
      fashion: fList[i % fList.length],
      video: vList[i % vList.length],
    });
  }
  return pairs;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Tạo 1 scene. onUpdate(patch) để cập nhật UI.
 * Trả { url, credit } hoặc throw Error(message từ API).
 */
export async function runScene({
  scene,
  model,
  settings,
  prompt,
  appId,
  credit,
  timeoutSeconds,
  onUpdate,
  isCancelled,
}) {
  const autoDuration = settings?.durationMode
    ? isAutoDurationMode(settings)
    : typeof settings?.durationFromVideo === 'boolean'
      ? settings.durationFromVideo
      : isAutoDurationEnabled();
  const refSeconds = Number(scene.video?.seconds) || 0;
  const useAuto = autoDuration && refSeconds > 0;
  const effectiveSettings = useAuto
    ? applyDurationFromSeconds(model, settings, refSeconds)
    : settings;

  // Snapshot project tại thời điểm tạo job → create + poll cùng scope
  // dù user đổi project giữa lúc đang chạy.
  // project_id = đúng id của project đang được chọn (từ API List Projects) — không suy đoán.
  ensureProjectBridgeGuard();
  const activeProjectId = getApiProjectId();
  console.info(
    `[project] runScene submit — project_id="${activeProjectId}" (đọc tại thời điểm gửi, không dùng closure)`,
  );
  if (!activeProjectId || !isProjectResolved()) {
    // Thà báo lỗi rõ hơn là gửi request không kèm project_id → video rơi vào project mặc định.
    throw new Error(
      'Chưa xác định được project từ API List Projects. Mở panel "0 · Project", bấm "Tải lại danh sách" và chọn project trước khi tạo video.',
    );
  }

  const body = buildCreateVideoBody(model, effectiveSettings, {
    prompt,
    appId,
    referenceUrls: [scene.characterUrl, scene.fashion.url].filter(Boolean),
    videoUrls: [scene.video.url].filter(Boolean),
    project_id: activeProjectId || undefined,
  });
  // Ép project_id vào body kể cả khi buildCreateVideoBody bỏ qua field này.
  if (activeProjectId) body.project_id = activeProjectId;
  onUpdate?.({ projectId: activeProjectId || '' });

  onUpdate?.({
    status: 'creating',
    message: useAuto
      ? `Đang gửi yêu cầu — thời lượng ${effectiveSettings.duration || '?'}s theo video ref ${Math.round(refSeconds * 10) / 10}s…`
      : 'Đang gửi yêu cầu tạo video…',
    appliedDuration: effectiveSettings?.duration || '',
    refSeconds,
  });

  let created;
  try {
    created = await gommoApi('/ai/create-video', { method: 'POST', body });
  } catch (error) {
    throw new Error(error?.message || 'Tạo video thất bại');
  }

  // Đối chiếu project_id GỬI vs project_id backend TRẢ VỀ.
  // Nếu lệch → parent bridge/backend đang ghi đè project_id của mini app
  // (đây là lý do video vẫn nằm ở project mặc định dù UI đã chọn project khác).
  const returnedProjectId = readReturnedProjectId(created);
  if (activeProjectId && returnedProjectId && returnedProjectId !== activeProjectId) {
    console.warn(
      `[project] MISMATCH — gửi project_id="${activeProjectId}" nhưng backend trả "${returnedProjectId}"`,
    );
  }
  onUpdate?.({
    projectIdSent: activeProjectId || '',
    projectIdReturned: returnedProjectId || '',
    projectMismatch: !!(activeProjectId && returnedProjectId && returnedProjectId !== activeProjectId),
  });

  const { jobId, raw } = parseMediaCreateResponse(created, 'video');
  onUpdate?.({
    status: 'running',
    jobId,
    message: raw?.message || 'Đã tiếp nhận → đang xử lý',
  });

  const result = await pollMediaJob('video', jobId, {
    projectId: activeProjectId || undefined,
    intervalMs: 15000,
    maxWaitMs: Math.max(60, Number(timeoutSeconds) || 3600) * 1000,
    isCancelled,
    onProgress: (payload) => {
      onUpdate?.({
        message:
          payload?.message ||
          payload?.videoInfo?.message ||
          payload?.status ||
          'Đang xử lý video…',
        apiStatus: payload?.status || '',
        percentApi: Number(payload?.videoInfo?.percent ?? payload?.percent ?? 0) || 0,
      });
    },
  });

  const url = result.url || result.download_url;
  if (!url) throw new Error('Job hoàn tất nhưng không có URL video');
  return { url, credit: Number(credit) || 0, status: result.status || 'SUCCESS' };
}

export async function notifySuccess({ sessionName, sceneIndex, url, attachMedia }) {
  const text = `✅ ${sessionName} — phân cảnh #${sceneIndex + 1} thành công`;
  return sendTelegram({ text, videos: attachMedia && url ? [url] : [] });
}

export async function notifyGroup({ sessionName, urls, from, to }) {
  const text = `📦 ${sessionName} — cụm phân cảnh #${from + 1}-#${to + 1} hoàn tất (${urls.length} video)`;
  return sendTelegram({ text, videos: urls });
}