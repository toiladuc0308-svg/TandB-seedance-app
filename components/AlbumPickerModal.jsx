import React from 'react';
import { Ghost } from './Ui.jsx';
import { gommoApi, toItems } from '../lib/api.js';
import { getApiProjectId } from '../lib/projectState.js';
import { normalizeLibraryVideo } from '../lib/videoLibrary.js';

export default function AlbumPickerModal({ isOpen, onClose, onSelect, kind = 'image', multiple = false }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadMedia = React.useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    try {
      const projectId = getApiProjectId();
      if (!projectId) {
        throw new Error('Chưa chọn project. Vui lòng chọn project trước khi xem album.');
      }

      console.info(`[Album] Đang tải ${kind} từ project: ${projectId}`);
      const endpoint = kind === 'video' ? '/ai/videos' : '/ai/images';
      
      const res = await gommoApi(endpoint, {
        method: 'POST',
        body: { project_id: projectId, page: 1, limit: 100 },
      });
      
      const rawItems = toItems(res);
      console.info(`[Album] Raw data từ ${endpoint}:`, rawItems);
      
      let processed = [];
      if (kind === 'video') {
        processed = rawItems.map(normalizeLibraryVideo).filter(Boolean);
      } else {
        // Parse Image
        processed = rawItems
          .map((row) => {
            if (!row) return null;
            const nested = row.result || row.data || row.imageInfo?.[0] || row.imageInfo || null;
            const merged = nested ? { ...nested, ...row } : row;
            
            const url = merged.url || merged.image_url || merged.download_url || merged.file_url;
            if (!url) return null;
            
            return {
              id: merged.id || merged.id_base || url,
              url,
              thumb: merged.thumb || merged.preview_url || url,
              status: String(merged.status || merged.state || '').toUpperCase(),
              prompt: merged.prompt || merged.name || '',
            };
          })
          .filter(Boolean);
          
        // Lọc SUCCESS cho ảnh
        processed = processed.filter(it => it.status === 'SUCCESS' || !it.status || it.status === 'UNDEFINED');
      }

      setItems(processed);
    } catch (err) {
      console.error('[Album] Lỗi load data:', err);
      setError(err?.message || 'Lỗi khi tải album. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [isOpen, kind]);

  React.useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  if (!isOpen) return null;

  const handleSelect = (item) => {
    onSelect([{ url: item.url, name: item.prompt || `${kind}.jpg` }]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-[#1a1a1a] rounded-2xl shadow-2xl flex flex-col h-[80vh] border border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <i className="ph ph-images text-[#c7ff44]" />
            Album Project {kind === 'video' ? 'Video' : 'Ảnh'}
          </h2>
          <div className="flex items-center gap-2">
            <Ghost icon="ph-arrows-clockwise" onClick={loadMedia} disabled={loading}>
              Làm mới
            </Ghost>
            <Ghost icon="ph-x" onClick={onClose} ariaLabel="Đóng" />
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto sb-scroll">
          {error && (
            <p className="bg-[#ef4444]/10 text-[#ef4444] p-3 rounded-xl text-sm mb-4">
              {error}
            </p>
          )}

          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <i className="ph ph-spinner animate-spin text-3xl text-[#777777]" />
            </div>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#777777]">
              <i className="ph ph-empty text-4xl mb-2" />
              <p>Chưa có {kind === 'video' ? 'video' : 'ảnh'} nào trong Project này.</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((it, idx) => (
              <button
                key={it.id || idx}
                type="button"
                className="group relative aspect-[3/4] bg-black rounded-xl overflow-hidden hover:ring-2 hover:ring-[#c7ff44] transition text-left"
                onClick={() => handleSelect(it)}
              >
                {kind === 'video' ? (
                  <video src={it.url} className="w-full h-full object-cover" preload="metadata" />
                ) : (
                  <img src={it.thumb || it.url} className="w-full h-full object-cover" loading="lazy" alt="" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="bg-[#c7ff44] text-black font-bold px-3 py-1.5 rounded-full text-sm">
                    Chọn
                  </span>
                </div>
                {it.prompt ? (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[10px] text-white truncate">
                    {it.prompt}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
