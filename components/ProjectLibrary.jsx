import React from 'react';
import { Ghost } from './Ui.jsx';
import { openLightbox } from '../lib/media.js';
import { listProjectVideos } from '../lib/videoLibrary.js';
import { getApiProjectId, subscribeProject } from '../lib/projectState.js';

/**
 * Thư viện video của project ĐANG CHỌN — đọc từ server bằng cùng project_id
 * mà engine dùng lúc tạo job, nên danh sách luôn khớp với nơi video được tạo.
 *
 * refreshSignal: số scene đã done của phiên hiện tại → tăng sau mỗi job SUCCESS
 * → tự query lại (không dùng cache cũ).
 */
export default function ProjectLibrary({ refreshSignal }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [projectId, setProjectId] = React.useState(getApiProjectId());
  const aliveRef = React.useRef(true);

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    
    // Debug: Kiểm tra xem load có bị gọi lại khi project_id thay đổi ngầm hay không
    console.info(`[debug] ProjectLibrary load() được gọi`);
    
    const res = await listProjectVideos({ limit: 60 });
    if (!aliveRef.current) return;
    setProjectId(res.projectId || '');
    const nextItems = Array.isArray(res.items) ? res.items : [];
    console.info(`[library] [sau khi gọi API list] Nhận ${nextItems.length} video hiển thị vào ProjectLibrary`);
    setItems(nextItems);
    // CHỈ ẨN UI: dòng cảnh báo "Chưa xác định được project…" không hiển thị nữa.
    // Không đổi listProjectVideos / getApiProjectId / isProjectResolved — luồng query
    // và luồng gửi project_id khi tạo video giữ nguyên 100%.
    const msg = String(res.error || '');
    setError(msg.includes('Chưa xác định được project') ? '' : msg);
    setLoading(false);
  }, []);

  // mount + sau mỗi scene SUCCESS
  React.useEffect(() => {
    load();
  }, [load, refreshSignal]);

  // đổi project → query lại bằng project_id mới (cùng store singleton)
  React.useEffect(() => {
    let unsubscribe;
    try {
      unsubscribe = subscribeProject((next) => {
        setProjectId(next || '');
        load();
      });
    } catch (e) {
      unsubscribe = undefined;
    }
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [load]);

  return (
    <section className="w-full rounded-2xl bg-[#1a1a1a] p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <i className="ph ph-folder-open text-[#c7ff44]" aria-hidden="true" />
          <h3 className="text-sm font-bold text-white">Thư viện video của project</h3>
          {projectId ? (
            <span
              title="project_id dùng để query danh sách (cùng nguồn với lúc tạo job)"
              className="truncate rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-[#b0b0b0]"
            >
              {projectId}
            </span>
          ) : null}
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-[#b0b0b0]">
            {items.length} video
          </span>
        </div>
        <Ghost icon={loading ? 'ph-spinner' : 'ph-arrows-clockwise'} onClick={load}>
          {loading ? 'Đang tải…' : 'Làm mới'}
        </Ghost>
      </header>

      {error ? (
        <p className="rounded-xl bg-[#f59e0b]/10 px-3 py-2 text-xs text-[#f59e0b]">{error}</p>
      ) : null}

      {!error && items.length === 0 && !loading ? (
        <p className="rounded-xl bg-black px-3 py-2 text-xs text-[#777777]">
          Chưa có video nào trong project này.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((v, idx) => (
            <div key={v.id ? `${v.id}_${idx}` : idx} className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-black">
              <div className="relative aspect-video w-full bg-[#111111]">
                {v.url ? (
                  <video
                    src={v.url}
                    poster={v.thumb || undefined}
                    className="h-full w-full object-cover"
                    controls
                    preload="metadata"
                    playsInline
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <i className="ph ph-hourglass text-2xl text-[#333333]" aria-hidden="true" />
                  </div>
                )}
                {v.url ? (
                  <button
                    type="button"
                    aria-label="Xem toàn màn hình"
                    onClick={() => openLightbox(v.url, 'video')}
                    className="absolute right-2 top-2 rounded-full bg-black/75 p-1.5 text-white"
                  >
                    <i className="ph ph-arrows-out" aria-hidden="true" />
                  </button>
                ) : null}
                {v.status ? (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] text-[#b0b0b0]">
                    {v.status}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1 p-2.5">
                <span className="truncate text-[11px] text-[#777777]">
                  {v.prompt || v.createdAt || v.id}
                </span>
                {v.url ? (
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[11px] font-bold text-[#c7ff44]"
                  >
                    Mở link video
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}