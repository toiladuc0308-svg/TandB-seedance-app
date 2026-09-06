/**
 * 79AI & Gommo MiniApp Bridge for Standalone Localhost.
 * Supports direct connection to 79AI (api.gommo.net) when Access Token is provided,
 * with fallback to demo mock data when no token is present.
 */

if (typeof window !== 'undefined' && !window.gommoMiniApp) {
  console.info('[79AI Bridge] Initializing 79AI bridge on localhost');

  const SETTINGS_KEY = 'seedance_fashion_studio_settings';
  const TOKEN_KEY = '79ai_access_token';
  const DOMAIN_KEY = '79ai_domain';

  const DEFAULT_DOMAIN = '79ai.net';
  const API_BASE = '/gommo-api';

  const SAMPLE_VIDEOS = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
  ];

  const MOCK_PROJECTS = [
    { id: 'seedance_demo_01', id_base: 'seedance_demo_01', name: 'Dự án Mẫu Demo 1', status: 'active' },
    { id: 'default', id_base: 'default', name: 'Dự án Mặc định (Demo)', status: 'active' }
  ];

  const JOBS = new Map();

  function getAuth() {
    return {
      token: (localStorage.getItem(TOKEN_KEY) || '').trim(),
      domain: (localStorage.getItem(DOMAIN_KEY) || DEFAULT_DOMAIN).trim(),
    };
  }

  async function call79AI(endpoint, { method = 'POST', params = {}, body = {} } = {}) {
    const { token, domain } = getAuth();
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    const formData = new URLSearchParams();
    if (token) formData.append('access_token', token);
    formData.append('domain', domain || DEFAULT_DOMAIN);

    // Merge params and body
    const combined = { ...params, ...body };
    for (const [k, v] of Object.entries(combined)) {
      if (v !== undefined && v !== null) {
        if (typeof v === 'object') {
          formData.append(k, JSON.stringify(v));
        } else {
          formData.append(k, String(v));
        }
      }
    }

    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: method.toUpperCase() === 'GET' ? undefined : formData.toString(),
    });

    const data = await res.json();
    if (data.error && data.error !== 0 && data.error !== 200) {
      throw new Error(data.message || data.error_message || `Lỗi 79AI API (${data.error})`);
    }
    return data;
  }

  window.gommoMiniApp = {
    isBridge: true,

    get79AIConfig() {
      return getAuth();
    },

    set79AIConfig(token, domain) {
      if (token !== undefined) localStorage.setItem(TOKEN_KEY, String(token || '').trim());
      if (domain !== undefined) localStorage.setItem(DOMAIN_KEY, String(domain || DEFAULT_DOMAIN).trim());
      window.dispatchEvent(new CustomEvent('79ai_auth_changed', { detail: getAuth() }));
    },

    async test79AIConnection(token, domain) {
      const t = String(token || '').trim();
      const d = String(domain || DEFAULT_DOMAIN).trim();
      if (!t) throw new Error('Vui lòng nhập Access Token');

      const formData = new URLSearchParams();
      formData.append('access_token', t);
      formData.append('domain', d);

      const res = await fetch(`${API_BASE}/ai/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: formData.toString(),
      });
      const json = await res.json();
      if (json.error && json.error !== 0 && json.error !== 200) {
        throw new Error(json.message || 'Token không hợp lệ hoặc đã hết hạn');
      }
      return json;
    },

    async call(action, payload = {}) {
      const { token, domain } = getAuth();

      // App Settings persistence
      if (action === 'app.settings.get') {
        try {
          const raw = localStorage.getItem(SETTINGS_KEY);
          return { value: raw ? JSON.parse(raw) : {} };
        } catch {
          return { value: {} };
        }
      }

      if (action === 'app.settings.patch') {
        try {
          const raw = localStorage.getItem(SETTINGS_KEY);
          const current = raw ? JSON.parse(raw) : {};
          const next = { ...current, ...(payload.value || {}) };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          return { ok: true };
        } catch (e) {
          console.warn('[79AI Bridge] Save settings failed', e);
          return { ok: false };
        }
      }

      // Media Uploads
      if (action === 'media.upload_image') {
        const url = payload.base64
          ? `data:${payload.mime || 'image/jpeg'};base64,${payload.base64}`
          : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80';
        return { url, name: payload.filename || 'image.jpg' };
      }

      if (action === 'media.upload_video') {
        const url = payload.base64
          ? `data:${payload.mime || 'video/mp4'};base64,${payload.base64}`
          : SAMPLE_VIDEOS[0];
        return { url, name: payload.filename || 'video.mp4', seconds: 15 };
      }

      if (action === 'album.open_picker') {
        const kind = payload.mediaTypes?.[0] || 'image';
        if (kind === 'video') {
          return {
            items: [
              { url: SAMPLE_VIDEOS[0], name: 'fashion_walk_01.mp4' },
              { url: SAMPLE_VIDEOS[1], name: 'dance_turn_02.mp4' },
            ],
          };
        }
        return {
          items: [
            {
              url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
              name: 'model_portrait_01.jpg',
            },
            {
              url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80',
              name: 'fashion_dress_02.jpg',
            },
            {
              url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&auto=format&fit=crop&q=80',
              name: 'streetwear_03.jpg',
            },
          ],
        };
      }

      if (action === 'media.open_lightbox') {
        if (payload.url) window.open(payload.url, '_blank');
        return { ok: true };
      }

      if (action === 'notification.send') {
        console.info('[79AI Notification]', payload);
        return { ok: true };
      }

      // API calls
      if (action === 'api.call') {
        const endpoint = payload.endpoint || payload.url || '';
        const method = (payload.method || 'GET').toUpperCase();

        // 1. If we have a token, route to real 79AI backend
        if (token) {
          try {
            return await call79AI(endpoint, {
              method,
              params: payload.params,
              body: payload.body,
            });
          } catch (err) {
            console.error(`[79AI Bridge] Real call to ${endpoint} failed:`, err);
            // Fallback for models or projects if network issues occur
            if (endpoint.startsWith('/ai/projects')) {
              console.warn('[79AI Bridge] Falling back to demo projects');
            } else {
              throw err;
            }
          }
        }

        // 2. No token: Real call for models if possible (models list is public)
        if (endpoint.startsWith('/ai/models')) {
          try {
            return await call79AI(endpoint, { method: 'POST', body: { type: 'video' } });
          } catch (e) {
            console.warn('[79AI Bridge] Fetch models without token failed, using mock models');
          }
        }

        // 3. Demo fallback when no token
        if (endpoint.startsWith('/ai/projects')) {
          return { code: 200, data: MOCK_PROJECTS };
        }

        if (endpoint.startsWith('/ai/create-video')) {
          const jobId = 'demo_job_' + Math.random().toString(36).substring(2, 9);
          JOBS.set(jobId, { id: jobId, createdAt: Date.now(), progress: 0 });
          return {
            code: 200,
            id_base: jobId,
            video_id: jobId,
            status: 'queued',
            message: 'Đã nhận task (Demo Mode - vui lòng nhập Token 79AI để tạo thật)',
          };
        }

        if (endpoint.startsWith('/ai/video')) {
          const params = payload.params || payload.body || {};
          const jobId = params.video_id || params.job_id || params.id || endpoint.split('/').pop();
          let job = JOBS.get(jobId);
          if (!job) {
            job = { id: jobId, createdAt: Date.now(), progress: 0 };
            JOBS.set(jobId, job);
          }
          const elapsed = (Date.now() - job.createdAt) / 1000;
          if (elapsed > 10) {
            return {
              code: 200,
              data: {
                id_base: job.id,
                status: 'success',
                video_url: SAMPLE_VIDEOS[0],
                url: SAMPLE_VIDEOS[0],
                percent: 100,
                message: 'Render hoàn thành (Demo)',
              },
            };
          }
          const p = Math.min(95, Math.round((elapsed / 10) * 100));
          return {
            code: 200,
            data: { id_base: job.id, status: 'processing', percent: p, message: `Đang render... (${p}%)` },
          };
        }

        if (endpoint.startsWith('/ai/videos')) {
          return { code: 200, data: [] };
        }

        return { code: 200, data: {} };
      }

      return { ok: true };
    },
  };
}
export default window.gommoMiniApp;
