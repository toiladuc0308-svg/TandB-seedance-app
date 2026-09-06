import React from 'react';
import { Panel, Dropdown, PanelSkeleton } from './Ui.jsx';
import { loadProjectsDetailed, resolveProjectId, findProject } from '../lib/projects.js';
import {
  getActiveProjectId,
  getApiProjectId,
  setActiveProjectId,
  setResolvedProjectId,
  getUserChoiceProjectId,
  clearUserChoiceProjectId,
  markProjectResolved,
  isProjectResolved,
  setProjectIdField,
} from '../lib/projectState.js';
import { ensureProjectBridgeGuard, getProjectBridgeStatus } from '../lib/projectBridge.js';
import { loadSettings, patchSettings } from '../lib/settings.js';

/** Lưu project đã chọn qua app.settings (retry 1 lần nếu bridge chưa sẵn sàng). */
async function persistProjectId(id) {
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    ok = await patchSettings({ projectId: id });
    if (!ok && attempt === 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return ok;
}

export default function ProjectPicker() {
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [projectId, setProjectId] = React.useState(getActiveProjectId());
  const [resolved, setResolved] = React.useState(isProjectResolved());
  const [bridge, setBridge] = React.useState(getProjectBridgeStatus());
  const aliveRef = React.useRef(true);

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** Gọi API List Projects (POST /ai/projects) và chốt project_id thật. */
  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    ensureProjectBridgeGuard();

    let savedId = '';
    try {
      const saved = await loadSettings();
      savedId = String(saved?.projectId || '').trim();
      // Dạng id gửi lên backend đã chốt trước đó (panel "Chẩn đoán project").
      setProjectIdField(String(saved?.projectIdField || '').trim());
    } catch (e) {
      savedId = '';
    }

    try {
      const { items, error: listError } = await loadProjectsDetailed();
      if (!aliveRef.current) return;
      setProjects(items);

      if (listError) {
        markProjectResolved(false);
        setResolved(false);
        setError(`Không đọc được danh sách project: ${listError}`);
        return;
      }
      if (items.length === 0) {
        markProjectResolved(false);
        setResolved(false);
        setError('API List Projects trả về danh sách rỗng — chưa có project_id thật để gửi.');
        return;
      }

      // Thứ tự ưu tiên: lựa chọn user đã bấm (sticky) > project đang active > project đã lưu.
      // load() có thể chạy lại (remount, reload models) — nó KHÔNG được phép ghi đè
      // lựa chọn của user, vì đó chính là lúc project_id bị reset về 'default'.
      const userChoice = getUserChoiceProjectId();
      const currentInStore = getActiveProjectId();
      const userPick = userChoice ? findProject(items, userChoice) : null;

      let next = '';
      let notice = '';
      if (userPick) {
        next = userPick.id;
      } else {
        if (userChoice && !userPick) {
          clearUserChoiceProjectId();
          notice = `Project bạn đã chọn ("${userChoice}") không còn trong danh sách.`;
        }
        const preferred = currentInStore || savedId;
        const strict = resolveProjectId(items, preferred, { strict: true });
        if (strict) {
          next = strict;
        } else {
          next = resolveProjectId(items, '');
          notice = `${notice ? `${notice} ` : ''}Project "${preferred}" không còn tồn tại — đã chuyển sang "${next}".`;
        }
      }

      setProjectId(next);
      // Không đánh dấu là user choice: đây là giá trị hệ thống resolve.
      setResolvedProjectId(next);
      markProjectResolved(true);
      setResolved(true);
      if (notice) setError(notice);
      console.info(
        `[project] resolved project_id="${next}" (userChoice="${userChoice}", store="${currentInStore}", savedId="${savedId}", items=${items.length})`,
      );
      if (next !== savedId) await persistProjectId(next);
    } finally {
      if (aliveRef.current) {
        setLoading(false);
        setBridge(getProjectBridgeStatus());
      }
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Theo dõi trạng thái bridge guard (bridge có thể sẵn sàng muộn).
  React.useEffect(() => {
    const t = setInterval(() => {
      ensureProjectBridgeGuard();
      setBridge(getProjectBridgeStatus());
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const options = React.useMemo(
    () =>
      projects.map((p) => ({
        type: p.id,
        // Hiển thị rõ id gửi lên API (id_base) để đối chiếu khi debug.
        name: p.name || p.id,
        description:
          p.rawId && p.rawId !== p.id
            ? `project_id gửi API: ${p.id} (id nội bộ: ${p.rawId})`
            : `project_id gửi API: ${p.id}`,
      })),
    [projects],
  );

  const handleChange = async (id) => {
    const next = String(id || '').trim();
    if (!next || next === projectId) return;
    if (!projects.some((p) => p.id === next)) return;
    setProjectId(next);
    setActiveProjectId(next);
    markProjectResolved(true);
    setResolved(true);
    setError('');
    const ok = await persistProjectId(next);
    if (!ok) {
      setError('Không lưu được project vào settings — sẽ thử lại ở lần tự lưu kế tiếp (30s).');
    }
  };

  const current = projects.find((p) => p.id === projectId) || null;
  const sendingProjectId = getApiProjectId();

  return (
    <Panel title="0 · Project" icon="ph-folder">
      {loading ? (
        <PanelSkeleton rows={2} />
      ) : (
        <div className="space-y-2">
          <Dropdown
            label="Dự án / Project"
            value={projectId}
            options={options}
            onChange={handleChange}
            placeholder="Chọn project"
            searchable
          />

          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-[#777777]">
              project_id gửi lên API:{' '}
              <span className={sendingProjectId ? 'text-[#c7ff44]' : 'text-[#ef4444]'}>
                {sendingProjectId || '—'}
              </span>
              {current?.name ? ` · ${current.name}` : ''}
            </p>
            <button
              type="button"
              onClick={load}
              className="shrink-0 rounded-xl bg-white/5 px-3 py-1.5 text-[11px] text-white transition hover:bg-white/10"
            >
              <i className="ph ph-arrows-clockwise mr-1" aria-hidden="true" />
              Tải lại danh sách
            </button>
          </div>

          <p className="text-[11px] leading-snug text-[#777777]">
            Bridge guard:{' '}
            <span className={bridge.guarded ? 'text-[#c7ff44]' : 'text-[#f59e0b]'}>
              {bridge.guarded ? 'đang bảo vệ project_id' : bridge.bridge ? 'chưa patch' : 'chưa có bridge'}
            </span>
          </p>

          {!resolved ? (
            <p className="rounded-xl bg-[#f59e0b]/10 px-3 py-2 text-[11px] leading-snug text-[#f59e0b]">
              Chưa xác định được project từ API List Projects — việc tạo video đang bị chặn để tránh
              video rơi vào project mặc định. Bấm “Tải lại danh sách” rồi chọn project.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-[#ef4444]/10 px-3 py-2 text-[11px] text-[#ef4444]">{error}</p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}