import React from 'react';
import { Ghost } from './Ui.jsx';
import { buildZipBlob, saveBlob } from '../lib/zip.js';

function safeBase(name) {
  return String(name || 'session')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40) || 'session';
}

function fileNameFor(sessionName, index, url) {
  const clean = String(url || '').split('?')[0];
  const m = clean.match(/\.(mp4|mov|webm|m4v|mkv)$/i);
  const ext = m ? m[1].toLowerCase() : 'mp4';
  return `${safeBase(sessionName)}_${String(index + 1).padStart(2, '0')}.${ext}`;
}

function triggerAnchor(href, filename, newTab) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  if (newTab) {
    a.target = '_blank';
    a.rel = 'noreferrer';
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Tải 1 file: ưu tiên blob (đặt được tên), fallback mở tab mới khi CORS chặn. */
async function downloadOne(url, filename) {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    triggerAnchor(objUrl, filename, false);
    setTimeout(() => URL.revokeObjectURL(objUrl), 20000);
    return true;
  } catch (error) {
    triggerAnchor(url, filename, true);
    return false;
  }
}

export default function BulkDownload({ scenes, sessionName }) {
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0, fallback: 0 });
  const [copied, setCopied] = React.useState(false);
  const [zipBusy, setZipBusy] = React.useState(false);
  const [zipStage, setZipStage] = React.useState({ done: 0, total: 0, skipped: 0 });
  const [zipError, setZipError] = React.useState('');
  const cancelRef = React.useRef(false);

  const ready = (Array.isArray(scenes) ? scenes : []).filter((s) => s.status === 'done' && s.url);
  if (ready.length === 0) return null;

  const runAll = async () => {
    cancelRef.current = false;
    setBusy(true);
    setProgress({ done: 0, total: ready.length, fallback: 0 });
    let fallback = 0;
    for (let i = 0; i < ready.length; i += 1) {
      if (cancelRef.current) break;
      const ok = await downloadOne(ready[i].url, fileNameFor(sessionName, i, ready[i].url));
      if (!ok) fallback += 1;
      setProgress({ done: i + 1, total: ready.length, fallback });
      // giãn nhịp để browser không chặn nhiều download liên tiếp
      await new Promise((r) => setTimeout(r, 600));
    }
    setBusy(false);
  };

  /** Đóng gói toàn bộ video render thành công thành 1 file ZIP. */
  const runZip = async () => {
    cancelRef.current = false;
    setZipError('');
    setZipBusy(true);
    setZipStage({ done: 0, total: ready.length, skipped: 0 });
    const files = [];
    let skipped = 0;
    for (let i = 0; i < ready.length; i += 1) {
      if (cancelRef.current) break;
      try {
        const res = await fetch(ready[i].url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        files.push({
          name: fileNameFor(sessionName, i, ready[i].url),
          blob: await res.blob(),
        });
      } catch (error) {
        skipped += 1;
      }
      setZipStage({ done: i + 1, total: ready.length, skipped });
    }
    try {
      if (files.length === 0) {
        throw new Error('Không tải được video nào (CORS chặn) — dùng “Tải tất cả”');
      }
      const blob = await buildZipBlob(files);
      saveBlob(blob, `${safeBase(sessionName)}_${files.length}_videos.zip`);
    } catch (error) {
      setZipError(error?.message || 'Đóng gói ZIP thất bại');
    } finally {
      setZipBusy(false);
    }
  };

  const copyLinks = async () => {
    const text = ready.map((s) => s.url).join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        /* noop */
      }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Ghost icon="ph-file-zip" onClick={runZip} disabled={busy || zipBusy}>
        {zipBusy
          ? `Đang đóng gói ${zipStage.done}/${zipStage.total}`
          : `Tải về hàng loạt (ZIP · ${ready.length})`}
      </Ghost>
      <Ghost icon="ph-download-simple" onClick={runAll} disabled={busy || zipBusy}>
        {busy ? `Đang tải ${progress.done}/${progress.total}` : `Tải tất cả (${ready.length})`}
      </Ghost>
      {busy ? (
        <Ghost icon="ph-x" onClick={() => { cancelRef.current = true; }}>
          Dừng
        </Ghost>
      ) : (
        <Ghost icon={copied ? 'ph-check' : 'ph-link'} onClick={copyLinks}>
          {copied ? 'Đã copy' : 'Copy link'}
        </Ghost>
      )}
      {zipBusy ? (
        <Ghost
          icon="ph-x"
          onClick={() => {
            cancelRef.current = true;
          }}
        >
          Dừng ZIP
        </Ghost>
      ) : null}
      {!busy && progress.total > 0 ? (
        <span className="text-[11px] text-[#777777]">
          {progress.done}/{progress.total} xong
          {progress.fallback > 0 ? ` · ${progress.fallback} mở tab mới` : ''}
        </span>
      ) : null}
      {!zipBusy && zipStage.skipped > 0 ? (
        <span className="text-[11px] text-[#f59e0b]">
          {zipStage.skipped} video không nhúng được vào ZIP
        </span>
      ) : null}
      {zipError ? <span className="text-[11px] text-[#ef4444]">{zipError}</span> : null}
    </div>
  );
}