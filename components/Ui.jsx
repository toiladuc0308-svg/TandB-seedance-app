import React from 'react';
const cls = (...a) => a.filter(Boolean).join(' ');

export function Panel({ title, icon, right, children, className }) {
  return (
    <section className={cls('w-full rounded-2xl border-0 bg-[#1a1a1a] p-4', className)}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon ? <i className={cls('ph text-[#c7ff44]', icon)} aria-hidden="true" /> : null}
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Label({ children }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#777777]">
      {children}
    </span>
  );
}

export function Chip({ children, active, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls(
        'inline-flex items-center rounded-full border-0 px-3 py-1 text-sm transition',
        disabled && 'opacity-40',
        active ? 'bg-[#c7ff44] font-bold text-[#0d0d0d]' : 'bg-white/5 text-[#b0b0b0] hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text', min, max, className }) {
  return (
    <input
      type={type}
      min={min}
      max={max}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cls(
        'w-full rounded-xl border-0 bg-[#1a1a1a] px-3 py-2.5 text-sm text-white outline-none',
        'placeholder:text-[#777777] focus:ring-2 focus:ring-[#c7ff44]/35',
        className,
      )}
    />
  );
}

export function NumberField({ label, value, onChange, min = 0, max, suffix }) {
  return (
    <label className="block w-full">
      {label ? <Label>{label}</Label> : null}
      <div className="flex items-center gap-2 rounded-xl bg-black px-3 py-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-0 bg-transparent text-sm text-white outline-none"
        />
        {suffix ? <span className="text-xs text-[#777777]">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left hover:bg-white/[0.06]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-[#777777]">{hint}</span> : null}
      </span>
      <span
        className={cls(
          'mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition',
          checked ? 'bg-[#c7ff44]' : 'bg-[#333333]',
        )}
      >
        <span
          className={cls(
            'h-5 w-5 rounded-full bg-[#0d0d0d] transition',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}

export function Dropdown({ label, value, options, onChange, placeholder = 'Chọn…', searchable }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 240 });

  const list = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => `${o.name} ${o.type}`.toLowerCase().includes(s));
  }, [options, q]);

  const selected = options.find((o) => o.type === value);

  const openMenu = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: Math.min(r.bottom + 6, window.innerHeight - 240),
        left: r.left,
        width: r.width,
      });
    }
    setQ('');
    setOpen(true);
  };

  return (
    <div className="w-full">
      {label ? <Label>{label}</Label> : null}
      <button
        ref={ref}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border-0 bg-[#1a1a1a] px-3 text-left text-sm text-white focus:ring-2 focus:ring-[#c7ff44]/35"
      >
        <span className={cls('truncate', !selected && 'text-[#777777]')}>
          {selected ? selected.name : placeholder}
        </span>
        <i className="ph ph-caret-down text-[#777777]" aria-hidden="true" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="sb-scroll fixed z-50 max-h-[min(360px,70vh)] overflow-auto rounded-2xl bg-[#1a1a1a] p-2 shadow-2xl shadow-black/40"
            style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 220) }}
          >
            {searchable ? (
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm…"
                className="mb-2 w-full rounded-xl border-0 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-[#777777]"
              />
            ) : null}
            {list.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#777777]">Không có kết quả</div>
            ) : (
              list.map((o) => (
                <button
                  key={o.type}
                  type="button"
                  onClick={() => {
                    onChange(o.type);
                    setOpen(false);
                  }}
                  className={cls(
                    'w-full rounded-xl px-3 py-2 text-left text-sm',
                    o.type === value
                      ? 'bg-[#c7ff44] font-bold text-[#0d0d0d]'
                      : 'text-white hover:bg-[#222222]',
                  )}
                >
                  <span className="block truncate">{o.name}</span>
                  {o.description ? (
                    <span
                      className={cls(
                        'mt-0.5 block truncate text-[11px]',
                        o.type === value ? 'text-[#0d0d0d]/70' : 'text-[#777777]',
                      )}
                    >
                      {o.description}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cls('animate-pulse rounded-xl bg-[#222222]', className)} />;
}

export function PanelSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function Cta({ children, onClick, disabled, icon, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls(
        'inline-flex items-center justify-center gap-2 rounded-xl border-0 bg-[#c7ff44] px-5 py-2.5 font-bold text-[#0d0d0d] transition',
        disabled ? 'opacity-40' : 'hover:brightness-95',
        className,
      )}
    >
      {icon ? <i className={cls('ph', icon)} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Ghost({ children, onClick, icon, className, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cls(
        'inline-flex items-center justify-center gap-1.5 rounded-xl border-0 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10',
        disabled && 'opacity-40',
        className,
      )}
    >
      {icon ? <i className={cls('ph', icon)} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}