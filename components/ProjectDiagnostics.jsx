import React from 'react';
import { Panel, Ghost, Chip } from './Ui.jsx';
import {
  getActiveProjectId,
  getApiProjectId,
  getActiveProjectRow,
  getActiveProjectCandidates,
  getProjectIdField,
  setProjectIdField,
  subscribeProject,
} from '../lib/projectState.js';
import { probeProjectIdShapes } from '../lib/projectProbe.js';
import { patchSettings } from '../lib/settings.js';

/** Audit từ bridge guard: project_id GỬI vs project_id backend TRẢ VỀ. */
function readAudit() {
  const log = (typeof window !== 'undefined' && window.__gommoProjectAudit) || [];
  return log
    .slice(-8)
    .reverse()
    .map((e, i) => {
      const sent = String(e?.sent ?? e?.project_id ?? e?.sentProjectId ?? '');
      const returned = String(e?.returned ?? e?.returned_project_id ?? e?.returnedProjectId ?? '');
      return {
        key: `${e?.at || 'x'}-${i}`,
        at: String(e?.at || '').slice(11, 19),
        endpoint: String(e?.endpoint || ''),
        sent,
        returned,
        mismatch: !!sent && !!returned && sent !== returned,
      };
    });
}

function lastSent() {
  const e = typeof window !== 'undefined' ? window.__gommoProjectLastSent : null;
  if (!e) return null;
  return {
    endpoint: String(e.endpoint || ''),
    projectId: String(e.project_id || ''),
    source: String(e.source || ''),
  };
}

/**
 * Panel chẩn đoán project: cho thấy CHÍNH XÁC project_id đang gửi lên, mọi dạng id
 * ứng viên của project đang chọn, và dạng nào backend thật sự hiểu.
 *
 * Dùng khi video vẫn vào project mặc định dù UI hiển thị project khác: nếu
 * "gửi" khác "backend trả về" → backend không nhận dạng id đang gửi → chọn dạng khác.
 */
export default function ProjectDiagnostics() {
  const [open, setOpen] = React.useState(false);
  const [projectId, setProjectId] = React.useState(getActiveProjectId());
  const [apiId, setApiId] = React.useState(getApiProjectId());
  const [field, setField] = React.useState(getProjectIdField());
  const [candidates, setCandidates] = React.useState(getActiveProjectCandidates());
  const [row, setRow] = React.useState(getActiveProjectRow());
  const [audit, setAudit] = React.useState(readAudit());
  const [probe, setProbe] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const sync = React.useCallback(() => {
    setProjectId(getActiveProjectId());
    setApiId(getApiProjectId());
    setField(getProjectIdField());
    setCandidates(getActiveProjectCandidates());
    setRow(getActiveProjectRow());
    setAudit(readAudit());
  }, []);

  React.useEffect(() => {
    let unsubscribe;
    try {
      unsubscribe = subscribeProject(() => sync());
    } catch (e) {
      unsubscribe = undefined;
    }
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [sync]);

  const chooseField = async (next) => {
    setProjectIdField(next);
    sync();
    await patchSettings({ projectIdField: next });
  };

  const runProbe = async () => {
    setBusy(true);
    try {
      const res = await probeProjectIdShapes();
      setProbe(res);
    } finally {
      setBusy(false);
      sync();
    }
  };

  const sentInfo = lastSent();
  const mismatchCount = audit.filter((a) => a.mismatch).length;

  return (
    <Panel
      title="0b · Chẩn đoán project"
      icon="ph-stethoscope"
      right={
        <Ghost icon={open ? 'ph-caret-up' : 'ph-caret-down'} onClick={() => { setOpen(!open); sync(); }}>
          {open ? 'Thu gọn' : 'Mở'}
        </Ghost>
      }
    >
      <div className="space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[#b0b0b0]">
            project đang chọn: {projectId || '—'}
          </span>
          <span className="rounded-full bg-[#c7ff44]/10 px-2 py-0.5 text-[#c7ff44]">
            project_id gửi lên: {apiId || '—'}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[#b0b0b0]">
            dạng id: {field || 'mặc định (id_base)'}
          </span>
          {mismatchCount > 0 ? (
            <span className="rounded-full bg-[#ef4444]/10 px-2 py-0.5 text-[#ef4444]">
              {mismatchCount} lần backend trả project_id KHÁC
            </span>
          ) : null}
        </div>

        {open ? (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[11px] text-[#777777]">
                Dạng id gửi lên backend — chọn dạng khác nếu video vẫn vào project mặc định:
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={!field} onClick={() => chooseField('')}>
                  mặc định
                </Chip>
                {candidates.map((c) => (
                  <Chip
                    key={`${c.field}:${c.value}`}
                    active={field === c.field}
                    onClick={() => chooseField(c.field)}
                  >
                    {c.field}={c.value}
                  </Chip>
                ))}
              </div>
              {candidates.length === 0 ? (
                <p className="mt-1 text-[11px] text-[#f59e0b]">
                  Chưa có raw row — bấm “Tải lại danh sách” ở panel Project.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Ghost icon={busy ? 'ph-spinner' : 'ph-radar'} onClick={runProbe}>
                {busy ? 'Đang kiểm tra…' : 'Kiểm tra dạng id (không tốn credit)'}
              </Ghost>
              <Ghost icon="ph-arrows-clockwise" onClick={sync}>
                Làm mới số liệu
              </Ghost>
            </div>

            {probe?.error ? (
              <p className="rounded-xl bg-[#f59e0b]/10 px-3 py-2 text-[11px] text-[#f59e0b]">
                {probe.error}
              </p>
            ) : null}

            {probe?.results?.length ? (
              <div className="space-y-1">
                <p className="text-[11px] text-[#777777]">
                  Dạng nào trả về video của project → backend hiểu dạng đó. Chọn đúng dạng ở trên.
                </p>
                {probe.results.map((r) => (
                  <div
                    key={`${r.field}:${r.value}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-black px-3 py-2"
                  >
                    <span className="font-bold text-white">
                      {r.field}={r.value}
                    </span>
                    <span className="text-[#b0b0b0]">{r.endpoint || 'không endpoint nào chạy'}</span>
                    <span className="text-[#b0b0b0]">{r.count} row</span>
                    <span className={r.matched > 0 ? 'text-[#c7ff44]' : 'text-[#777777]'}>
                      khớp project_id: {r.matched}
                    </span>
                    {r.returnedProjectIds?.length ? (
                      <span className="text-[#777777]">
                        backend trả: {r.returnedProjectIds.join(', ')}
                      </span>
                    ) : null}
                    {r.error ? <span className="text-[#ef4444]">{r.error}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {sentInfo ? (
              <p className="rounded-xl bg-black px-3 py-2 text-[11px] text-[#b0b0b0]">
                Request gần nhất: {sentInfo.endpoint} · project_id="{sentInfo.projectId}" · nguồn={sentInfo.source}
              </p>
            ) : null}

            {audit.length ? (
              <div className="space-y-1">
                <p className="text-[11px] text-[#777777]">Gửi vs backend trả về (job endpoints):</p>
                {audit.map((a) => (
                  <div
                    key={a.key}
                    className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ${
                      a.mismatch ? 'bg-[#ef4444]/10' : 'bg-black'
                    }`}
                  >
                    <span className="text-[#777777]">{a.at}</span>
                    <span className="text-white">{a.endpoint}</span>
                    <span className="text-[#b0b0b0]">gửi: {a.sent || '—'}</span>
                    <span className={a.mismatch ? 'text-[#ef4444]' : 'text-[#c7ff44]'}>
                      trả về: {a.returned || '—'}
                    </span>
                    {a.mismatch ? (
                      <span className="font-bold text-[#ef4444]">MISMATCH</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-black px-3 py-2 text-[11px] text-[#777777]">
                Chưa có job nào để đối chiếu — tạo 1 video rồi xem lại panel này.
              </p>
            )}

            {row ? (
              <details className="rounded-xl bg-black px-3 py-2">
                <summary className="cursor-pointer text-[11px] text-[#b0b0b0]">
                  Raw row của project đang chọn
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-[#777777]">
                  {JSON.stringify(row, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}