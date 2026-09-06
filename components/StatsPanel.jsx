import { formatCredit } from '../utils/format.js';

function Stat({ label, value, tone }) {
  return (
    <div className="min-w-0 rounded-xl bg-black px-3 py-2.5">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-[#777777]">
        {label}
      </span>
      <span className={`block truncate text-lg font-bold ${tone || 'text-white'}`}>{value}</span>
    </div>
  );
}

export default function StatsPanel({ stats }) {
  return (
    <section className="w-full rounded-2xl border-0 bg-[#1a1a1a] p-4">
      <header className="mb-3 flex items-center gap-2">
        <i className="ph ph-chart-bar text-[#c7ff44]" aria-hidden="true" />
        <h3 className="text-sm font-bold text-white">Thống kê tổng</h3>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Tổng task" value={stats.total} />
        <Stat label="Thành công" value={stats.done} tone="text-[#22c55e]" />
        <Stat label="Lỗi" value={stats.error} tone="text-[#ef4444]" />
        <Stat label="Đang chạy / chờ" value={stats.pending} tone="text-[#f59e0b]" />
        <Stat label="Credit đã dùng" value={formatCredit(stats.credit)} tone="text-[#c7ff44]" />
      </div>
    </section>
  );
}