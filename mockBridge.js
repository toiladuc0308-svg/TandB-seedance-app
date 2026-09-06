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

  /**
   * Upload media file to get a direct, permanent, publicly reachable HTTPS URL.
   */
  async function uploadMediaToCloud(payload, kind = 'image') {
    const { token, domain } = getAuth();
    const filename = payload.filename || (kind === 'video' ? 'video.mp4' : 'image.jpg');
    const mime = payload.mime || (kind === 'video' ? 'video/mp4' : 'image/jpeg');

    let fileObj = payload.file;
    if (!fileObj && payload.base64) {
      try {
        const byteCharacters = atob(payload.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        fileObj = new Blob([new Uint8Array(byteNumbers)], { type: mime });
      } catch (e) {
        console.warn('[Upload] Failed to parse base64 blob:', e);
      }
    }

    // 1. Try 79AI official /ai/upload first if token exists
    if (token && fileObj) {
      try {
        console.info(`[79AI Upload] Uploading ${kind} to 79AI server via FormData...`);
        const form = new FormData();
        form.append('access_token', token);
        form.append('domain', domain || DEFAULT_DOMAIN);
        form.append('type', kind);
        form.append('file', fileObj, filename);
        if (payload.project_id) form.append('project_id', payload.project_id);

        const res = await fetch(`${API_BASE}/ai/upload`, {
          method: 'POST',
          body: form,
        });
        const json = await res.json();
        const url =
          json?.data?.url ||
          json?.url ||
          json?.data?.file_url ||
          json?.file_url ||
          json?.items?.[0]?.url;

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          console.info('[79AI Upload] Success via 79AI:', url);
          return url;
        }
      } catch (err) {
        console.warn('[79AI Upload] 79AI upload failed, trying public host:', err);
      }
    }

    // 2. Upload via /catbox-upload to get permanent raw direct HTTPS URL
    if (fileObj) {
      try {
        console.info(`[Upload] Uploading ${kind} to Catbox host...`);
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fileObj, filename);

        const res = await fetch('/catbox-upload', {
          method: 'POST',
          body: form,
        });
        const directUrl = (await res.text()).trim();
        if (directUrl && (directUrl.startsWith('https://') || directUrl.startsWith('http://'))) {
          console.info('[Upload] Catbox direct URL:', directUrl);
          return directUrl;
        }
      } catch (err) {
        console.warn('[Upload] Catbox host failed:', err);
      }

      // 3. Fallback to Litterbox for large files or if Catbox fails
      try {
        console.info(`[Upload] Uploading ${kind} to Litterbox fallback...`);
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('time', '72h');
        form.append('fileToUpload', fileObj, filename);

        const res = await fetch('/litterbox-upload', {
          method: 'POST',
          body: form,
        });
        const directUrl = (await res.text()).trim();
        if (directUrl && (directUrl.startsWith('https://') || directUrl.startsWith('http://'))) {
          console.info('[Upload] Litterbox direct URL:', directUrl);
          return directUrl;
        }
      } catch (err) {
        console.warn('[Upload] Litterbox host failed:', err);
      }
    }

    throw new Error(
      'Không thể tải file lên để tạo link trực tiếp. Vui lòng bấm "Dán link" để nhập URL trực tiếp (https://...).'
    );
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

      // App Settings persistence with Quota protection
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

          // Sanitize: Do not store giant base64 strings in localStorage!
          if (next.character?.url?.startsWith('data:') || next.character?.url?.includes('tmpfiles.org')) {
            next.character = null;
          }
          if (Array.isArray(next.fashion)) {
            next.fashion = next.fashion.filter(
              (f) => f?.url && !f.url.startsWith('data:') && !f.url.includes('tmpfiles.org')
            );
          }
          if (Array.isArray(next.videos)) {
            next.videos = next.videos.filter(
              (v) => v?.url && !v.url.startsWith('data:') && !v.url.includes('tmpfiles.org')
            );
          }

          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          return { ok: true };
        } catch (e) {
          console.warn('[79AI Bridge] Save settings failed', e);
          return { ok: false };
        }
      }

      // Media Uploads
      if (action === 'media.upload_image') {
        const url = await uploadMediaToCloud(payload, 'image');
        return { url, name: payload.filename || 'image.jpg' };
      }

      if (action === 'media.upload_video') {
        const url = await uploadMediaToCloud(payload, 'video');
        return { url, name: payload.filename || 'video.mp4', seconds: payload.seconds || 15 };
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
          return await call79AI(endpoint, {
            method,
            params: payload.params,
            body: payload.body,
          });
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
