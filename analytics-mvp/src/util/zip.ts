// Минимальный ридер ZIP (без зависимостей): отчёты Маркета скачиваются zip-архивом с одним
// CSV/XLSX внутри. Поддержка методов 0 (stored) и 8 (deflate) через zlib.inflateRawSync.
// Читаем central directory с конца файла - так надёжнее, чем идти по local headers.
import { inflateRawSync } from "node:zlib";

export interface ZipEntry { name: string; data: Buffer }

export function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

export function unzip(buf: Buffer): ZipEntry[] {
  // End of central directory (0x06054b50) - ищем с конца (комментарий архива до 64К).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip: не найден central directory");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip: битая запись central directory");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf-8");
    // local header: имя/extra могут отличаться по длине от central
    const lnlen = buf.readUInt16LE(lho + 26), lelen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnlen + lelen;
    const raw = buf.subarray(start, start + csize);
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = inflateRawSync(raw);
    else throw new Error(`zip: метод сжатия ${method} не поддерживается (${name})`);
    if (usize && data.length !== usize) throw new Error(`zip: размер ${name} ${data.length} != ${usize}`);
    if (!name.endsWith("/")) out.push({ name, data });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
