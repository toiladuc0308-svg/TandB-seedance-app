export default function SessionTabs({ sessions, activeId, onSelect, onClose }) {
  if (sessions.length === 0) return null;
  return (
    <div className="sb-scroll flex w-full items-center gap-2 overflow-x-auto pb-1">
      {sessions.map((s) => {
        const active = s.id === activeId;
        const running = s.scenes.some((x) => x.status === 'creating' || x.status === 'running');
        return (
          <div
            key={s.id}
            className={
              active
                ? 'flex shrink-0 items-center gap-2 rounded-xl bg-[#c7ff44] px-3 py-2 text-sm font-bold text-[#0d0d0d]'
                : 'flex shrink-0 items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2 text-sm text-[#b0b0b0] hover:bg-[#222222]'
            }
          >
            <button type="button" onClick={() => onSelect(s.id)} className="flex items-center gap-1.5">
              <i
                className={running ? 'ph ph-spinner' : 'ph ph-squares-four'}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">{s.name}</span>
              <span className={active ? 'text-[#0d0d0d]/70' : 'text-[#777777]'}>
                {s.scenes.filter((x) => x.status === 'done').length}/{s.scenes.length}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Đóng ${s.name}`}
              onClick={() => onClose(s.id)}
              className={active ? 'text-[#0d0d0d]/70 hover:text-[#0d0d0d]' : 'text-[#777777] hover:text-white'}
            >
              <i className="ph ph-x text-xs" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}