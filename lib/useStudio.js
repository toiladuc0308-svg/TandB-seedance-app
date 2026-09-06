/** State + runner hook cho Seedance Fashion Studio. */

import React from 'react';
import { loadVideoModels, getDefaultMediaSettings, resolveVideoActiveSource, getPriceForModelWithSettings } from './modelCatalog.js';
import { loadSettings, patchSettings, patchSettingsKeepProject } from './settings.js';
import { subscribeProject, getActiveProjectId } from './projectState.js';
import { buildPairs, runScene, notifySuccess, notifyGroup } from './engine.js';
import { setAutoDurationEnabled } from './runtimeFlags.js';
import { uid } from '../utils/format.js';
import {
  DEFAULT_MODEL_ID,
  DEFAULT_PROMPT,
  DEFAULT_RUN_SETTINGS,
  DEFAULT_SESSION_SETTINGS,
} from '../data/config.js';

const APP_ID =
  (typeof window !== 'undefined' && window.__gommoMiniAppContext?.appId) ||
  'code_chat_755ea554-24c8-4ff4-b53f-9c7548eafa88';

export default function useStudio() {
  const [models, setModels] = React.useState([]);
  const [modelsLoading, setModelsLoading] = React.useState(true);
  const [modelsError, setModelsError] = React.useState('');
  const [selectedId, setSelectedId] = React.useState('');
  const [modelSettings, setModelSettings] = React.useState({});
  const [prompt, setPrompt] = React.useState(DEFAULT_PROMPT);
  const [projectVersion, setProjectVersion] = React.useState(0);

  const [character, setCharacter] = React.useState(null);
  const [fashion, setFashion] = React.useState([]);
  const [videos, setVideos] = React.useState([]);
  const [lockedFashion, setLockedFashion] = React.useState([]);
  const [lockedVideo, setLockedVideo] = React.useState([]);

  const [runSettings, setRunSettings] = React.useState(DEFAULT_RUN_SETTINGS);
  const [sessionSettings, setSessionSettings] = React.useState(DEFAULT_SESSION_SETTINGS);

  const [sessions, setSessions] = React.useState([]);
  const [activeSession, setActiveSession] = React.useState('');
  const [tick, setTick] = React.useState(Date.now());
  const [toast, setToast] = React.useState('');

  const cancelRef = React.useRef({});
  const hydrated = React.useRef(false);

  // ---- ticker cho đồng hồ + % giả lập
  React.useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // ---- sync mode "thời lượng theo video up" cho engine
  React.useEffect(() => {
    const auto = runSettings.durationMode
      ? runSettings.durationMode === 'auto'
      : runSettings.durationFromVideo !== false;
    setAutoDurationEnabled(auto);
  }, [runSettings.durationMode, runSettings.durationFromVideo]);

  // ---- hydrate settings
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadSettings();
      if (!alive) return;
      if (saved.prompt) setPrompt(saved.prompt);
      if (saved.runSettings) setRunSettings({ ...DEFAULT_RUN_SETTINGS, ...saved.runSettings });
      if (saved.sessionSettings)
        setSessionSettings({ ...DEFAULT_SESSION_SETTINGS, ...saved.sessionSettings });
      if (saved.character) setCharacter(saved.character);
      if (Array.isArray(saved.fashion)) setFashion(saved.fashion);
      if (Array.isArray(saved.videos)) setVideos(saved.videos);
      if (Array.isArray(saved.lockedFashion)) setLockedFashion(saved.lockedFashion);
      if (Array.isArray(saved.lockedVideo)) setLockedVideo(saved.lockedVideo);
      if (saved.selectedId) setSelectedId(saved.selectedId);
      if (saved.modelSettings) setModelSettings(saved.modelSettings);
      hydrated.current = true;
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- snapshot state để autosave (ref cập nhật mỗi render, không tạo effect phụ)
  const persistRef = React.useRef(null);
  persistRef.current = {
    prompt,
    runSettings,
    sessionSettings,
    character,
    fashion,
    videos,
    lockedFashion,
    lockedVideo,
    selectedId,
    modelSettings,
  };
  const lastSavedRef = React.useRef('');

  const flushSettings = React.useCallback(async (reason = 'auto') => {
    if (!hydrated.current) return false;
    // KHÔNG ghi projectId rỗng: nếu store chưa resolve, giữ nguyên giá trị đã lưu
    // (patchSettingsKeepProject sẽ bỏ key projectId khỏi payload).
    const activeProjectId = getActiveProjectId();
    const snapshot = { ...(persistRef.current || {}) };
    if (activeProjectId) snapshot.projectId = activeProjectId;
    let serialized = '';
    try {
      serialized = JSON.stringify(snapshot);
    } catch (error) {
      serialized = '';
    }
    if (serialized && serialized === lastSavedRef.current) return false;
    
    // Debug log
    console.info(`[debug] flushSettings (reason=${reason}) projectId=${activeProjectId || '(rỗng)'}`);
    
    const ok = await patchSettingsKeepProject(snapshot, activeProjectId);
    if (ok) lastSavedRef.current = serialized;
    else console.warn('[settings] autosave failed', reason);
    return ok;
  }, []);

  // ---- autosave mỗi 30s + flush khi ẩn tab / rời trang
  React.useEffect(() => {
    const timer = setInterval(() => {
      flushSettings('interval');
    }, 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushSettings('hidden');
    };
    const onBeforeUnload = () => {
      flushSettings('unload');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [flushSettings]);

  // ---- đổi project → lưu ngay + reload danh sách model theo project mới
  React.useEffect(
    () =>
      subscribeProject(() => {
        setProjectVersion((v) => v + 1);
        flushSettings('project-change');
      }),
    [flushSettings],
  );

  // ---- đổi project → reload danh sách model theo project mới
  React.useEffect(() => subscribeProject(() => setProjectVersion((v) => v + 1)), []);

  // ---- load models
  React.useEffect(() => {
    let alive = true;
    (async () => {
      setModelsLoading(true);
      setModelsError('');
      try {
        const list = await loadVideoModels();
        if (!alive) return;
        setModels(list);
        setSelectedId((cur) => {
          if (cur && list.some((m) => m.id_base === cur)) return cur;
          const preferred = list.find((m) => m.id_base === DEFAULT_MODEL_ID);
          return preferred?.id_base || list[0]?.id_base || '';
        });
      } catch (e) {
        if (alive) setModelsError(e?.message || 'Không tải được danh sách model');
      } finally {
        if (alive) setModelsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectVersion]);

  const model = React.useMemo(
    () => models.find((m) => m.id_base === selectedId) || null,
    [models, selectedId],
  );

  // ---- defaults khi đổi model
  React.useEffect(() => {
    if (!model) return;
    const source = resolveVideoActiveSource(model, modelSettings.mode);
    setModelSettings((cur) => {
      const next = getDefaultMediaSettings(source, cur);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.id_base]);

  // ---- persist
  React.useEffect(() => {
    if (!hydrated.current) return;
    const id = setTimeout(() => {
      patchSettings({
        prompt,
        runSettings,
        sessionSettings,
        selectedId,
        modelSettings,
        character,
        fashion,
        videos,
        lockedFashion,
        lockedVideo,
      });
    }, 600);
    return () => clearTimeout(id);
  }, [
    prompt,
    runSettings,
    sessionSettings,
    selectedId,
    modelSettings,
    character,
    fashion,
    videos,
    lockedFashion,
    lockedVideo,
  ]);

  const patchScene = React.useCallback((sessionId, sceneId, patch) => {
    setSessions((cur) =>
      cur.map((s) =>
        s.id !== sessionId
          ? s
          : {
              ...s,
              scenes: s.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...patch } : sc)),
            },
      ),
    );
  }, []);

  const creditPerScene = React.useMemo(() => {
    if (!model) return 0;
    const source = resolveVideoActiveSource(model, modelSettings.mode);
    return getPriceForModelWithSettings(model, modelSettings, source);
  }, [model, modelSettings]);

  const executeScene = React.useCallback(
    async (sessionId, scene) => {
      patchScene(sessionId, scene.id, {
        status: 'creating',
        error: '',
        url: '',
        startedAt: Date.now(),
        endedAt: null,
        percentApi: 0,
        message: 'Đang gửi yêu cầu…',
      });
      try {
        const out = await runScene({
          scene,
          model,
          settings: modelSettings,
          prompt,
          appId: APP_ID,
          credit: creditPerScene,
          timeoutSeconds: runSettings.timeoutSeconds,
          onUpdate: (patch) => patchScene(sessionId, scene.id, patch),
          isCancelled: () => !!cancelRef.current[sessionId],
        });
        patchScene(sessionId, scene.id, {
          status: 'done',
          url: out.url,
          credit: out.credit,
          endedAt: Date.now(),
          message: 'Hoàn tất',
          apiStatus: out.status,
        });
        if (runSettings.fashionOnce && scene.fashion?.url) {
          setLockedFashion((cur) => (cur.includes(scene.fashion.url) ? cur : [...cur, scene.fashion.url]));
        }
        if (runSettings.videoOnce && scene.video?.url) {
          setLockedVideo((cur) => (cur.includes(scene.video.url) ? cur : [...cur, scene.video.url]));
        }
        if (runSettings.notifyTelegram) {
          notifySuccess({
            sessionName: scene.sessionName,
            sceneIndex: scene.index,
            url: out.url,
            attachMedia: runSettings.notifyAttachMedia && Number(runSettings.notifyMediaCount) > 0,
          }).catch(() => {});
        }
        return { ok: true, url: out.url };
      } catch (e) {
        patchScene(sessionId, scene.id, {
          status: 'error',
          error: e?.message || 'Tạo video thất bại',
          endedAt: Date.now(),
        });
        return { ok: false };
      }
    },
    [model, modelSettings, prompt, creditPerScene, runSettings, patchScene],
  );

  const runQueue = React.useCallback(
    async (sessionId, sceneList) => {
      const concurrency = Math.max(1, Number(sessionSettings.concurrency) || 1);
      const groupSize = Math.max(1, Number(runSettings.groupMediaCount) || 1);
      let cursor = 0;
      let groupBuf = [];
      let groupFrom = 0;

      const flushGroup = (to) => {
        if (!runSettings.sendGroupMedia || groupBuf.length === 0) {
          groupBuf = [];
          return;
        }
        const urls = [...groupBuf];
        const from = groupFrom;
        groupBuf = [];
        groupFrom = to + 1;
        notifyGroup({
          sessionName: sceneList[0]?.sessionName || 'Phiên',
          urls,
          from,
          to,
        }).catch(() => {});
      };

      const worker = async () => {
        while (cursor < sceneList.length) {
          if (cancelRef.current[sessionId]) return;
          const idx = cursor;
          cursor += 1;
          const res = await executeScene(sessionId, sceneList[idx]);
          if (res.ok && res.url) {
            groupBuf.push(res.url);
            if (groupBuf.length >= groupSize) flushGroup(idx);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, sceneList.length) }).map(() => worker()),
      );
      flushGroup(sceneList.length - 1);
    },
    [executeScene, sessionSettings.concurrency, runSettings.sendGroupMedia, runSettings.groupMediaCount],
  );

  const blockedReason = React.useMemo(() => {
    if (!model) return 'Chưa chọn model video.';
    if (!character?.url) return 'Cần 1 ảnh nhân vật ở panel 1.';
    if (fashion.length === 0) return 'Cần ít nhất 1 ảnh thời trang ở panel 2.';
    if (videos.length === 0) return 'Cần ít nhất 1 video ở panel 3.';
    if (!prompt.trim()) return 'Prompt đang trống.';
    return '';
  }, [model, character, fashion, videos, prompt]);

  const createSession = React.useCallback(() => {
    if (blockedReason) {
      setToast(blockedReason);
      return;
    }
    let pairs;
    try {
      pairs = buildPairs({
        characterUrl: character.url,
        fashion,
        videos,
        maxVideos: sessionSettings.maxVideos,
        randomFashion: runSettings.randomFashion,
        randomVideo: runSettings.randomVideo,
        usedFashion: lockedFashion,
        usedVideo: lockedVideo,
        fashionOnce: runSettings.fashionOnce,
        videoOnce: runSettings.videoOnce,
      });
    } catch (e) {
      setToast(e?.message || 'Không tạo được danh sách phân cảnh');
      return;
    }

    const sessionId = uid('ss');
    const name = `Phiên ${sessions.length + 1}`;
    const scenes = pairs.map((p) => ({
      id: uid('sc'),
      index: p.index,
      sessionName: name,
      characterUrl: p.characterUrl,
      fashion: p.fashion,
      video: p.video,
      status: 'queued',
      message: 'Trong hàng chờ',
      error: '',
      url: '',
      credit: 0,
      percentApi: 0,
      startedAt: null,
      endedAt: null,
    }));

    cancelRef.current[sessionId] = false;
    setSessions((cur) => [
      ...cur,
      { id: sessionId, name, createdAt: Date.now(), scenes, model: model.id_base },
    ]);
    setActiveSession(sessionId);
    setToast('');
    runQueue(sessionId, scenes);
  }, [
    blockedReason,
    character,
    fashion,
    videos,
    sessionSettings.maxVideos,
    runSettings,
    lockedFashion,
    lockedVideo,
    sessions.length,
    model,
    runQueue,
  ]);

  const retryScene = React.useCallback(
    (sceneId) => {
      const session = sessions.find((s) => s.scenes.some((sc) => sc.id === sceneId));
      if (!session) return;
      const scene = session.scenes.find((sc) => sc.id === sceneId);
      if (!scene) return;
      cancelRef.current[session.id] = false;
      executeScene(session.id, scene);
    },
    [sessions, executeScene],
  );

  const stopSession = React.useCallback((sessionId) => {
    cancelRef.current[sessionId] = true;
    setSessions((cur) =>
      cur.map((s) =>
        s.id !== sessionId
          ? s
          : {
              ...s,
              scenes: s.scenes.map((sc) =>
                sc.status === 'queued'
                  ? { ...sc, status: 'error', error: 'Đã dừng', endedAt: Date.now() }
                  : sc,
              ),
            },
      ),
    );
  }, []);

  const closeSession = React.useCallback(
    (sessionId) => {
      cancelRef.current[sessionId] = true;
      setSessions((cur) => cur.filter((s) => s.id !== sessionId));
      setActiveSession((cur) => {
        if (cur !== sessionId) return cur;
        const rest = sessions.filter((s) => s.id !== sessionId);
        return rest[rest.length - 1]?.id || '';
      });
    },
    [sessions],
  );

  const stats = React.useMemo(() => {
    const all = sessions.flatMap((s) => s.scenes);
    return {
      total: all.length,
      done: all.filter((s) => s.status === 'done').length,
      error: all.filter((s) => s.status === 'error').length,
      pending: all.filter((s) => s.status !== 'done' && s.status !== 'error').length,
      credit: all.filter((s) => s.status === 'done').reduce((sum, s) => sum + (Number(s.credit) || 0), 0),
    };
  }, [sessions]);

  const running = React.useMemo(
    () =>
      sessions.some((s) => s.scenes.some((x) => x.status === 'creating' || x.status === 'running')),
    [sessions],
  );

  return {
    models,
    modelsLoading,
    modelsError,
    selectedId,
    setSelectedId,
    modelSettings,
    patchModelSettings: (p) => setModelSettings((cur) => ({ ...cur, ...p })),
    prompt,
    setPrompt,
    character,
    setCharacter,
    fashion,
    setFashion,
    videos,
    setVideos,
    lockedFashion,
    lockedVideo,
    resetFashionLocks: () => setLockedFashion([]),
    resetVideoLocks: () => setLockedVideo([]),
    runSettings,
    patchRunSettings: (p) => setRunSettings((cur) => ({ ...cur, ...p })),
    sessionSettings,
    patchSessionSettings: (p) => setSessionSettings((cur) => ({ ...cur, ...p })),
    sessions,
    activeSession,
    setActiveSession,
    createSession,
    retryScene,
    stopSession,
    closeSession,
    stats,
    running,
    tick,
    toast,
    setToast,
    blockedReason,
  };
}