import { Cta, NumberField, Ghost } from './Ui.jsx';

export default function CreateBar({
  concurrency,
  maxVideos,
  onPatch,
  onCreate,
  onStopAll,
  canCreate,
  running,
  blockedReason,
}) {
  return (
    <section className="w-full rounded-2xl border-0 bg-[#1a1a1a] p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
        <NumberField
          label="Số luồng đồng thời"
          value={concurrency}
          min={1}
          max={20}
          onChange={(v) => onPatch({ concurrency: Math.max(1, Math.min(20, Number(v) || 1)) })}
        />
        <NumberField
          label="Số video tối đa"
          value={maxVideos}
          min={1}
          max={200}
          onChange={(v) => onPatch({ maxVideos: Math.max(1, Math.min(200, Number(v) || 1)) })}
        />
        <div className="col-span-2 flex items-center gap-2 sm:col-span-2 sm:justify-end">
          {running ? (
            <Ghost icon="ph-stop-circle" onClick={onStopAll}>
              Dừng
            </Ghost>
          ) : null}
          <Cta icon="ph-play" onClick={onCreate} disabled={!canCreate} className="flex-1 sm:flex-none">
            Tạo phiên mới
          </Cta>
        </div>
      </div>
      {blockedReason ? (
        <p className="mt-2 text-xs text-[#f59e0b]">{blockedReason}</p>
      ) : null}
    </section>
  );
}