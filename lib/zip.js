/** ZIP writer thuần JS — store method (không nén), đủ dùng cho mp4/webm. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date();
  const dosTime =
    (Math.floor(d.getSeconds() / 2) & 0x1f) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((d.getHours() & 0x1f) << 11);
  const dosDate =
    (d.getDate() & 0x1f) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    ((Math.max(0, d.getFullYear() - 1980) & 0x7f) << 9);
  return { dosTime, dosDate };
}

async function toBytes(source) {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (source && typeof source.arrayBuffer === 'function') {
    return new Uint8Array(await source.arrayBuffer());
  }
  throw new Error('Nguồn dữ liệu ZIP không hợp lệ');
}

/**
 * Ghép nhiều file thành 1 Blob ZIP (store, no-deflate).
 * entries: [{ name, blob }] hoặc [{ name, bytes }]
 * onProgress(done, total) — gọi sau mỗi file.
 * Lưu ý: không hỗ trợ ZIP64 (tổng < 4GB).
 */
export async function buildZipBlob(entries, onProgress) {
  const list = (Array.isArray(entries) ? entries : []).filter((e) => e && e.name);
  if (list.length === 0) throw new Error('Không có file nào để đóng gói');

  const enc = new TextEncoder();
  const { dosTime, dosDate } = dosDateTime(new Date());
  const parts = [];
  const central = [];
  let offset = 0;

  for (let i = 0; i < list.length; i += 1) {
    const entry = list[i];
    const bytes = await toBytes(entry.bytes || entry.blob);
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(bytes);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, bytes.length, true);
    lv.setUint32(22, bytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local, bytes);
    central.push({ nameBytes, crc, size: bytes.length, offset });
    offset += local.length + bytes.length;
    onProgress?.(i + 1, list.length);
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) {
    const rec = new Uint8Array(46 + c.nameBytes.length);
    const cv = new DataView(rec.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, c.crc, true);
    cv.setUint32(20, c.size, true);
    cv.setUint32(24, c.size, true);
    cv.setUint16(28, c.nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, c.offset, true);
    rec.set(c.nameBytes, 46);
    parts.push(rec);
    centralSize += rec.length;
  }

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);
  parts.push(end);

  return new Blob(parts, { type: 'application/zip' });
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default { crc32, buildZipBlob, saveBlob };