import { Ghost } from './Ui.jsx';
import { formatDuration, simulatedPercent } from '../utils/format.js';
import { openLightbox } from '../lib/media.js';

const STATUS_META = {
  queued: { label: 'Chờ', color: 'text-[#777777]', icon: 'ph-hourglass' },
  creating: { label: 'Đang gửi', color: 'text-[#f59e0b]', icon: 'ph-paper-plane-tilt' },
  running: { label: 'Đang tạo', color: 'text-[#f59e0b]', icon: 'ph-spinner' },
  done: { label: 'Thành công', color: 'text-[#22c55e]', icon: 'ph-check-circle' },
  error: { label: 'Lỗi', color: 'text-[#ef4444]', icon: 'ph-warning-circle' },
};

export default function SceneCard({ scene, index, timeoutSeconds, onRetry, tick }) {
  const meta = STATUS_META[scene.status] || STATUS_META.queued;
  const active = scene.status === 'creating' || scene.status === 'running';
  const elapsed = scene.startedAt ? (scene.endedAt || tick) - scene.startedAt : 0;
  const expected = Math.min(Math.max(60, Number(timeoutSeconds) || 3600), 900) * 1000;
  const pct =
    scene.status === 'done'
      ? 100
      : scene.status === 'error'
        ? 100
        : Math.max(scene.percentApi || 0, simulatedPercent(elapsed, expected));

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-black">
      <div className="relative aspect-video w-full bg-[#111111]">
        {scene.status === 'done' && scene.url ? (
          <video
            src={scene.url}
            className="h-full w-full object-cover"
            controls
            preload="metadata"
            playsInline
          />
        ) : scene.status === 'done' && !scene.url ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center">
            <i className="ph ph-eye-slash text-2xl text-[#f59e0b]" aria-hidden="true" />
            <span className="text-[11px] leading-snug text-[#f59e0b]">
              Job xong nhưng không có URL preview — kiểm tra project của job
              {scene.projectId ? ` (project_id="${scene.projectId}")` : ''}
            </span>
          </div>
        ) : active ? (
          <div className="shimmer relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden">
            <span className="text-2xl font-bold text-[#c7ff44]">{pct}%</span>
            <span className="text-xs text-[#b0b0b0]">{formatDuration(elapsed)}</span>
          </div>
        ) : scene.status === 'error' ? (
          <div className="flex h-full w-full items-center justify-center">
            <i className="ph ph-warning-circle text-3xl text-[#ef4444]" aria-hidden="true" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <i className="ph ph-hourglass text-2xl text-[#333333]" aria-hidden="true" />
          </div>
        )}

        <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white">
          #{index + 1}
        </span>
        {scene.appliedDuration ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] text-[#c7ff44]">
            {scene.appliedDuration}s{scene.refSeconds ? ` ← ref ${Math.round(scene.refSeconds * 10) / 10}s` : ''}
          </span>
        ) : null}
        {scene.projectId ? (
          <span
            title={`project_id gửi lên khi tạo job: ${scene.projectId}`}
            className={
              scene.returnedProjectId && scene.returnedProjectId !== scene.projectId
                ? 'absolute bottom-2 right-2 rounded-full bg-[#ef4444]/85 px-2 py-0.5 text-[10px] font-bold text-white'
                : 'absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] text-[#b0b0b0]'
            }
          >
            {scene.returnedProjectId && scene.returnedProjectId !== scene.projectId
              ? `${scene.projectId} → ${scene.returnedProjectId}`
              : scene.projectId}
          </span>
        ) : null}
        {scene.status === 'done' && scene.url ? (
          <button
            type="button"
            aria-label="Xem toàn màn hình"
            onClick={() => openLightbox(scene.url, 'video')}
            className="absolute right-2 top-2 rounded-full bg-black/75 p-1.5 text-white"
          >
            <i className="ph ph-arrows-out" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="h-1 w-full bg-[#1a1a1a]">
        <div
          className={
            scene.status === 'error'
              ? 'h-full bg-[#ef4444] transition-all'
              : 'h-full bg-[#c7ff44] transition-all'
          }
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 p-2.5">
        <div className="flex items-center gap-1.5">
          <i className={`ph ${meta.icon} ${meta.color}`} aria-hidden="true" />
          <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
          {scene.startedAt ? (
            <span className="ml-auto text-[11px] text-[#777777]">{formatDuration(elapsed)}</span>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          {scene.characterUrl ? (
            <img src={scene.characterUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
          ) : null}
          {scene.fashion?.url ? (
            <img src={scene.fashion.url} alt="" className="h-7 w-7 rounded-lg object-cover" />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-[11px] text-[#777777]">
            {scene.video?.name || scene.video?.url || ''}
          </span>
        </div>

        <p className="line-clamp-2 min-h-[28px] text-[11px] leading-snug text-[#b0b0b0]">
          {scene.error || scene.message || '—'}
        </p>

        <div className="flex items-center gap-1.5">
          <Ghost icon="ph-arrow-counter-clockwise" onClick={() => onRetry(scene.id)} disabled={active}>
            Tạo lại
          </Ghost>
          {scene.status === 'done' && scene.url ? (
            <a
              href={scene.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              <i className="ph ph-download-simple" aria-hidden="true" />
              Tải
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}