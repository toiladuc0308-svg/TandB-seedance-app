import React from 'react';
import { Panel, Ghost, Chip } from './Ui.jsx';
import {
  uploadImageFile,
  uploadVideoFile,
  pickFromAlbum,
  openLightbox,
  openMediaLightbox,
  probeVideoDuration,
} from '../lib/media.js';
import { shortName, formatSeconds } from '../utils/format.js';

const FIT_CLASS = { contain: 'object-contain', cover: 'object-cover' };

function useUploader(kind, onDone) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const inputRef = React.useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const out = [];
      const fileList = Array.from(files);
      console.info(`[upload] Bắt đầu upload ${fileList.length} file (${kind})`);
      for (let i = 0; i < fileList.length; i += 1) {
        const f = fileList[i];
        const item = kind === 'image' ? await uploadImageFile(f) : await uploadVideoFile(f);
        out.push(item);
        console.info(`[upload] File ${i + 1}/${fileList.length} upload thành công:`, item?.name || item?.url);
      }
      console.info(`[upload] [sau upload] Nhận được ${out.length}/${fileList.length} media thành công (${kind})`);
      onDone(out);
    } catch (e) {
      console.error(`[upload] Lỗi trong quá trình upload (${kind}):`, e);
      setError(e?.message || 'Upload thất bại');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const fromAlbum = async (multiple) => {
    setBusy(true);
    setError('');
    try {
      const items = await pickFromAlbum(kind, multiple);
      console.info(`[upload] [sau upload / album] Nhận được ${items.length} media từ album (${kind})`);
      if (items.length) onDone(items);
    } catch (e) {
      setError(e?.message || 'Không chọn được media');
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, inputRef, handleFiles, fromAlbum };
}

function FitToggle({ fit, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <Chip active={fit === 'contain'} onClick={() => onChange('contain')}>
        Toàn ảnh
      </Chip>
      <Chip active={fit === 'cover'} onClick={() => onChange('cover')}>
        Cắt
      </Chip>
    </div>
  );
}

function IconButton({ label, icon, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-full bg-black/75 p-1.5 text-white hover:bg-black"
    >
      <i className={`ph ${icon}`} aria-hidden="true" />
    </button>
  );
}

export function CharacterInput({ value, onChange }) {
  const up = useUploader('image', (items) => onChange(items[0] || null));
  const [fit, setFit] = React.useState('contain');

  return (
    <Panel
      title="1 · Ảnh nhân vật"
      icon="ph-user-focus"
      right={
        <div className="flex items-center gap-1.5">
          {value?.url ? (
            <Ghost icon="ph-eye" onClick={() => openLightbox(value.url, 'image')}>
              Preview
            </Ghost>
          ) : null}
          <FitToggle fit={fit} onChange={setFit} />
        </div>
      }
    >
      <input
        ref={up.inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => up.handleFiles(e.target.files)}
      />
      {value ? (
        <div className="relative overflow-hidden rounded-xl bg-[#111] border border-white/10 min-h-[220px] flex items-center justify-center">
          <img
            src={value.previewUrl || value.url}
            alt="Nhân vật"
            onClick={() => openLightbox(value.previewUrl || value.url, 'image')}
            onError={(e) => {
              if (value.previewUrl && e.currentTarget.src !== value.previewUrl) {
                e.currentTarget.src = value.previewUrl;
              }
            }}
            className={`w-full cursor-zoom-in ${
              fit === 'cover'
                ? 'h-56 object-cover'
                : 'h-auto max-h-[460px] min-h-[200px] object-contain p-1'
            }`}
          />
          <div className="absolute top-0 inset-x-0 flex items-center justify-end gap-1.5 p-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10">
            <IconButton
              label="Xem trước ảnh nhân vật"
              icon="ph-eye"
              onClick={() => openLightbox(value.previewUrl || value.url, 'image')}
            />
            <IconButton label="Xoá ảnh nhân vật" icon="ph-x" onClick={() => onChange(null)} />
          </div>
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-2 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
            <span className="shrink-0 rounded-full bg-black/80 px-2 py-0.5 text-[11px] font-bold text-[#c7ff44]">
              @image1
            </span>
            {value.name ? (
              <span className="truncate rounded-full bg-black/80 px-2 py-0.5 text-[10px] text-[#b0b0b0]" title={value.name}>
                {shortName(value.name, 22)}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex h-56 items-center justify-center rounded-xl bg-black/40 border border-dashed border-white/10 text-sm text-[#777777]">
          {up.busy ? 'Đang tải lên…' : 'Chưa có ảnh nhân vật'}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Ghost icon="ph-upload-simple" onClick={() => up.inputRef.current?.click()} disabled={up.busy}>
          Tải ảnh
        </Ghost>
        <Ghost
          icon="ph-link"
          onClick={() => {
            const url = window.prompt('Nhập hoặc dán link URL ảnh nhân vật (https://...):', value?.url || '');
            if (url && url.trim()) {
              const trimmed = url.trim();
              if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                alert('Vui lòng nhập link URL hợp lệ bắt đầu bằng https://');
                return;
              }
              onChange({ url: trimmed, name: trimmed.split('/').pop()?.split('?')[0] || 'image.jpg' });
            }
          }}
          disabled={up.busy}
        >
          Dán link
        </Ghost>
        <Ghost icon="ph-images" onClick={() => up.fromAlbum(false)} disabled={up.busy}>
          Album
        </Ghost>
        {value ? (
          <Ghost icon="ph-eye" onClick={() => openLightbox(value.url, 'image')}>
            Preview
          </Ghost>
        ) : null}
      </div>
      {up.error ? <p className="mt-2 text-xs text-[#ef4444]">{up.error}</p> : null}
    </Panel>
  );
}

export function FashionInput({ items, onChange, lockedUrls, onResetLocks }) {
  const list = Array.isArray(items) ? items : [];
  const locked = Array.isArray(lockedUrls) ? lockedUrls : [];
  const up = useUploader('image', (added) =>
    onChange((prev) => {
      const current = Array.isArray(prev) ? prev : list;
      return [...current, ...added];
    }),
  );
  const [fit, setFit] = React.useState('contain');
  const [cols, setCols] = React.useState(2);

  const remove = (url) =>
    onChange((prev) => (Array.isArray(prev) ? prev : list).filter((i) => i.url !== url));
  const preview = (index) =>
    openMediaLightbox(
      list.map((i) => ({ url: i.url, type: 'image' })),
      index,
      'image',
    );

  return (
    <Panel
      title="2 · Ảnh thời trang"
      icon="ph-t-shirt"
      right={<span className="text-xs text-[#777777]">{list.length} ảnh</span>}
    >
      <input
        ref={up.inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => up.handleFiles(e.target.files)}
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <FitToggle fit={fit} onChange={setFit} />
        <div className="flex items-center gap-1.5">
          {[2, 3, 4].map((n) => (
            <Chip key={n} active={cols === n} onClick={() => setCols(n)}>
              {n} cột
            </Chip>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-xl bg-black text-sm text-[#777777]">
          {up.busy ? 'Đang tải lên…' : 'Chưa có ảnh thời trang'}
        </div>
      ) : (
        <div className="sb-scroll max-h-[420px] overflow-y-auto pr-1">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {list.map((it, index) => {
              const isLocked = locked.includes(it.url);
              return (
                <div
                  key={it.url ? `${it.url}_${index}` : index}
                  className={`group relative overflow-hidden rounded-xl bg-[#111] border min-h-[160px] h-44 flex items-center justify-center ${
                    isLocked ? 'border-[#f59e0b]' : 'border-white/10'
                  }`}
                >
                  <img
                    src={it.previewUrl || it.url}
                    alt={it.name || `Thời trang ${index + 1}`}
                    loading="lazy"
                    onClick={() => preview(index)}
                    onError={(e) => {
                      if (it.previewUrl && e.currentTarget.src !== it.previewUrl) {
                        e.currentTarget.src = it.previewUrl;
                      }
                    }}
                    className={`h-full w-full cursor-zoom-in ${
                      fit === 'cover' ? 'object-cover' : 'object-contain p-1'
                    } ${isLocked ? 'opacity-35' : ''}`}
                  />
                  <div className="absolute top-0 inset-x-0 flex items-center justify-end gap-1 p-1.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10">
                    <IconButton
                      label={`Xem trước ảnh ${index + 1}`}
                      icon="ph-eye"
                      onClick={() => preview(index)}
                    />
                    <IconButton
                      label={`Xoá ảnh ${index + 1}`}
                      icon="ph-x"
                      onClick={() => remove(it.url)}
                    />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-1 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
                    {isLocked ? (
                      <span className="shrink-0 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] text-[#f59e0b]">
                        đã dùng
                      </span>
                    ) : <span />}
                    <span className="truncate rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] text-[#b0b0b0]" title={it.name}>
                      {shortName(it.name || `#${index + 1}`, 18)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Ghost icon="ph-upload-simple" onClick={() => up.inputRef.current?.click()} disabled={up.busy}>
          Tải ảnh
        </Ghost>
        <Ghost
          icon="ph-link"
          onClick={() => {
            const url = window.prompt('Nhập hoặc dán link URL ảnh thời trang (https://...):');
            if (url && url.trim()) {
              const trimmed = url.trim();
              if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                alert('Vui lòng nhập link URL hợp lệ bắt đầu bằng https://');
                return;
              }
              onChange((prev) => [
                ...(Array.isArray(prev) ? prev : list),
                { url: trimmed, name: trimmed.split('/').pop()?.split('?')[0] || 'fashion.jpg' },
              ]);
            }
          }}
          disabled={up.busy}
        >
          Dán link
        </Ghost>
        <Ghost icon="ph-images" onClick={() => up.fromAlbum(true)} disabled={up.busy}>
          Album
        </Ghost>
        {list.length ? (
          <Ghost icon="ph-eye" onClick={() => preview(0)}>
            Preview tất cả
          </Ghost>
        ) : null}
        {locked.length ? (
          <Ghost icon="ph-lock-open" onClick={onResetLocks}>
            Reset khoá ({locked.length})
          </Ghost>
        ) : null}
        {list.length ? (
          <Ghost icon="ph-trash" onClick={() => onChange([])}>
            Xoá hết
          </Ghost>
        ) : null}
      </div>
      {up.busy ? <p className="mt-2 text-xs text-[#777777]">Đang tải lên…</p> : null}
      {up.error ? <p className="mt-2 text-xs text-[#ef4444]">{up.error}</p> : null}
    </Panel>
  );
}

export function VideoInput({ items, onChange, lockedUrls, onResetLocks }) {
  const list = Array.isArray(items) ? items : [];
  const locked = Array.isArray(lockedUrls) ? lockedUrls : [];
  console.info(`[videoInput] [trước khi render] Danh sách hiển thị: ${list.length} video`);

  const up = useUploader('video', (added) => {
    console.info(`[videoInput] [sau upload] Thêm ${added.length} video vào danh sách`);
    onChange((prev) => {
      const current = Array.isArray(prev) ? prev : list;
      const next = [...current, ...added];
      console.info(`[videoInput] Gộp state video: ${current.length} cũ + ${added.length} mới = ${next.length} video`);
      return next;
    });
  });
  const [cols, setCols] = React.useState(2);

  const remove = (url) =>
    onChange((prev) => (Array.isArray(prev) ? prev : list).filter((i) => i.url !== url));
  const preview = (index) =>
    openMediaLightbox(
      list.map((i) => ({ url: i.url, type: 'video' })),
      index,
      'video',
    );

  // đo thời lượng cho video còn thiếu (video đã lưu từ phiên trước / chọn từ album)
  React.useEffect(() => {
    const missing = list.filter((it) => it.url && !(Number(it.seconds) > 0));
    if (missing.length === 0) return undefined;
    let alive = true;
    (async () => {
      const map = {};
      for (const it of missing) {
        const s = await probeVideoDuration(it.url);
        if (s > 0) map[it.url] = s;
      }
      if (!alive || Object.keys(map).length === 0) return;
      // ROOT CAUSE FIX: dùng functional update thay vì closure list cũ để không GHI ĐÈ 10 video vừa upload bằng list cũ
      onChange((prev) => {
        const current = Array.isArray(prev) ? prev : list;
        return current.map((it) => (map[it.url] ? { ...it, seconds: map[it.url] } : it));
      });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const known = list.filter((it) => Number(it.seconds) > 0);
  const totalSeconds = known.reduce((sum, it) => sum + Number(it.seconds), 0);

  return (
    <Panel
      title="3 · Video tham chiếu"
      icon="ph-video"
      right={<span className="text-xs text-[#777777]">{list.length} video</span>}
    >
      <input
        ref={up.inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => up.handleFiles(e.target.files)}
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-[#777777]">
          Thời lượng render theo từng video (bật ở panel 5)
        </span>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <Chip key={n} active={cols === n} onClick={() => setCols(n)}>
              {n} cột
            </Chip>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-xl bg-black text-sm text-[#777777]">
          {up.busy ? 'Đang tải lên…' : 'Chưa có video tham chiếu'}
        </div>
      ) : (
        <div className="sb-scroll max-h-[420px] overflow-y-auto pr-1">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {list.map((it, index) => {
              const isLocked = locked.includes(it.url);
              return (
                <div
                  key={it.url ? `${it.url}_${index}` : index}
                  className="group relative overflow-hidden rounded-xl bg-[#111] border border-white/10 min-h-[140px] flex items-center justify-center"
                >
                  <div className="aspect-video w-full">
                    <video
                      src={it.previewUrl || it.url}
                      className={`h-full w-full object-contain ${isLocked ? 'opacity-35' : ''}`}
                      preload="metadata"
                      muted
                      playsInline
                      controls
                    />
                  </div>
                  <div className="absolute top-0 inset-x-0 flex items-center justify-between p-1.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10">
                    <span className="rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-bold text-[#c7ff44]">
                      {Number(it.seconds) > 0 ? formatSeconds(it.seconds) : 'đang đo…'}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconButton
                        label={`Xem trước video ${index + 1}`}
                        icon="ph-eye"
                        onClick={() => preview(index)}
                      />
                      <IconButton
                        label={`Xoá video ${index + 1}`}
                        icon="ph-x"
                        onClick={() => remove(it.url)}
                      />
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-1 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
                    {isLocked ? (
                      <span className="shrink-0 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] text-[#f59e0b]">
                        đã dùng
                      </span>
                    ) : <span />}
                    <span className="truncate rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] text-[#b0b0b0]" title={it.name}>
                      {shortName(it.name || `@video${index + 1}`, 22)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {known.length ? (
        <p className="mt-2 text-[11px] text-[#777777]">
          Tổng {formatSeconds(totalSeconds)} · trung bình{' '}
          {formatSeconds(totalSeconds / known.length)}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Ghost icon="ph-upload-simple" onClick={() => up.inputRef.current?.click()} disabled={up.busy}>
          Tải video
        </Ghost>
        <Ghost
          icon="ph-link"
          onClick={() => {
            const url = window.prompt('Nhập hoặc dán link URL video tham chiếu (https://...):');
            if (url && url.trim()) {
              const trimmed = url.trim();
              if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                alert('Vui lòng nhập link URL hợp lệ bắt đầu bằng https://');
                return;
              }
              const sec = window.prompt('Thời lượng video tính bằng giây (ví dụ: 15):', '15');
              onChange((prev) => [
                ...(Array.isArray(prev) ? prev : list),
                {
                  url: trimmed,
                  name: trimmed.split('/').pop()?.split('?')[0] || 'video.mp4',
                  seconds: Number(sec) || 15,
                },
              ]);
            }
          }}
          disabled={up.busy}
        >
          Dán link
        </Ghost>
        <Ghost icon="ph-images" onClick={() => up.fromAlbum(true)} disabled={up.busy}>
          Album
        </Ghost>
        {list.length ? (
          <Ghost icon="ph-eye" onClick={() => preview(0)}>
            Preview tất cả
          </Ghost>
        ) : null}
        {locked.length ? (
          <Ghost icon="ph-lock-open" onClick={onResetLocks}>
            Reset khoá ({locked.length})
          </Ghost>
        ) : null}
        {list.length ? (
          <Ghost icon="ph-trash" onClick={() => onChange([])}>
            Xoá hết
          </Ghost>
        ) : null}
      </div>
      {up.busy ? <p className="mt-2 text-xs text-[#777777]">Đang tải lên…</p> : null}
      {up.error ? <p className="mt-2 text-xs text-[#ef4444]">{up.error}</p> : null}
    </Panel>
  );
}

export default { CharacterInput, FashionInput, VideoInput };