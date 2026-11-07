import { inflateSync, unzlibSync } from 'fflate';
import { StatementFileError } from '../statements/errors';
import { STATEMENT_LIMITS } from '../statements/limits';

// Хаан банкны хуулга бол зураг биш, FlateDecode текст PDF.
// Энд pdf.js ашиглаагүй: Expo Go дээр worker/DOM шаарддаггүй, файл төхөөрөмжөөс гарахгүй.

export type TextItem = { x: number; y: number; text: string };
export type TextPage = { page: number; width: number; height: number; items: TextItem[] };

export type ExtractOptions = {
  maxPages?: number;
  signal?: AbortSignal;
  onPage?: (done: number, total: number) => void;
};

type FontDec = { cmap: Map<number, string> | null; width: number };
type PdfObj = { num: number; header: string; stream: Uint8Array | null };

type Token =
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'bytes'; v: Uint8Array }
  | { t: 'arr_s' }
  | { t: 'arr'; v: Token[] };

const latin1 = new TextDecoder('latin1');

function asLatin1(bytes: Uint8Array): string {
  return latin1.decode(bytes);
}

function inflateStream(data: Uint8Array, header: string): Uint8Array {
  if (!/\/FlateDecode\b/.test(header)) return data;
  try {
    // PDF FlateDecode нь zlib толгойтой. Зарим генератор цэвэр deflate өгдөг.
    const out = data[0] === 0x78 ? unzlibSync(data) : inflateSync(data);
    if (out.length > 8_000_000) throw new StatementFileError('too_large');
    return out;
  } catch (error) {
    if (error instanceof StatementFileError) throw error;
    try {
      const out = inflateSync(data);
      if (out.length > 8_000_000) throw new StatementFileError('too_large');
      return out;
    } catch {
      throw new StatementFileError('corrupt');
    }
  }
}

function indexObjects(file: Uint8Array): Map<number, PdfObj> {
  const text = asLatin1(file);
  if (!text.startsWith('%PDF-')) throw new StatementFileError('corrupt');

  const streamRanges: { dataStart: number; dataEnd: number }[] = [];
  const lengthRe = /\/Length\s+(\d+)\s*>>\s*stream\r?\n/g;
  const streams: { dictAt: number; dataStart: number; length: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = lengthRe.exec(text))) {
    const length = Number(match[1]);
    const dataStart = match.index + match[0].length;
    if (!Number.isFinite(length) || dataStart + length > file.length) throw new StatementFileError('corrupt');
    streams.push({ dictAt: match.index, dataStart, length });
    streamRanges.push({ dataStart, dataEnd: dataStart + length });
  }

  const inside = (index: number) => streamRanges.some((r) => index >= r.dataStart && index < r.dataEnd);
  const objects: { num: number; at: number }[] = [];
  const objRe = /(\d+)\s+0\s+obj\b/g;
  while ((match = objRe.exec(text))) {
    if (!inside(match.index)) objects.push({ num: Number(match[1]), at: match.index + match[0].length });
  }
  objects.sort((a, b) => a.at - b.at);

  const map = new Map<number, PdfObj>();
  for (let i = 0; i < objects.length; i++) {
    const start = objects[i].at;
    const end = i + 1 < objects.length ? objects[i + 1].at : text.length;
    const headerEndRel = text.slice(start, end).search(/\b(stream|endobj)\b/);
    const header = headerEndRel >= 0 ? text.slice(start, start + headerEndRel) : text.slice(start, end);
    const stream = streams.find((s) => s.dictAt >= start && s.dictAt < end);
    const bytes = stream ? file.subarray(stream.dataStart, stream.dataStart + stream.length) : null;
    if (/\/Encrypt\b/.test(header)) throw new StatementFileError('encrypted');
    map.set(objects[i].num, {
      num: objects[i].num,
      header,
      stream: bytes ? inflateStream(bytes, header) : null,
    });
  }
  return map;
}

function refsOf(header: string, key: string): number[] {
  const re = new RegExp(`/${key}\\s*(\\[[^\\]]*\\]|\\d+\\s+0\\s+R)`);
  const found = re.exec(header);
  if (!found) return [];
  const nums: number[] = [];
  const refRe = /(\d+)\s+0\s+R/g;
  let m: RegExpExecArray | null;
  while ((m = refRe.exec(found[1]))) nums.push(Number(m[1]));
  return nums;
}

function isType(header: string, type: string): boolean {
  return new RegExp(`\\/Type\\s*\\/${type}(?![A-Za-z])`).test(header);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const padded = clean.length % 2 ? `${clean}0` : clean;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function destString(hex: string): string {
  const bytes = hexToBytes(hex);
  if (bytes.length <= 1) return String.fromCharCode(bytes[0] ?? 0);
  let text = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return text;
}

function parseCMap(stream: Uint8Array): FontDec {
  const text = asLatin1(stream);
  const map = new Map<number, string>();
  const space = /begincodespacerange\s*<([0-9A-Fa-f]+)>/.exec(text);
  const width = space ? Math.max(1, space[1].length / 2) : 2;

  const addRange = (block: string) => {
    const single = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let m: RegExpExecArray | null;
    while ((m = single.exec(block))) {
      const from = Number.parseInt(m[1], 16);
      const to = Number.parseInt(m[2], 16);
      const dest = Number.parseInt(m[3], 16);
      if (to - from > 5000) continue;
      for (let n = 0; n <= to - from; n++) map.set(from + n, String.fromCodePoint(dest + n));
    }
    const arrays = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
    while ((m = arrays.exec(block))) {
      const from = Number.parseInt(m[1], 16);
      const dests = [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((d) => destString(d[1]));
      dests.forEach((ch, n) => map.set(from + n, ch));
    }
  };

  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(Number.parseInt(pair[1], 16), destString(pair[2]));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) addRange(block[1]);
  return { cmap: map, width };
}

function readLiteral(text: string, start: number): { bytes: Uint8Array; next: number } {
  let i = start + 1;
  const out: number[] = [];
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      const n = text[i + 1] ?? '';
      if (n === 'n') out.push(10);
      else if (n === 'r') out.push(13);
      else if (n === 't') out.push(9);
      else if (n === 'b') out.push(8);
      else if (n === 'f') out.push(12);
      else if (n === '\n' || n === '\r') {
        i += 2;
        if (n === '\r' && text[i] === '\n') i++;
        continue;
      } else if (/[0-7]/.test(n)) {
        let oct = n;
        let k = i + 2;
        for (let extra = 0; extra < 2 && k < text.length && /[0-7]/.test(text[k]); extra++, k++) oct += text[k];
        out.push(Number.parseInt(oct, 8) & 255);
        i = k;
        continue;
      } else out.push(n.charCodeAt(0) & 255);
      i += 2;
      continue;
    }
    if (c === ')') return { bytes: Uint8Array.from(out), next: i + 1 };
    out.push(c.charCodeAt(0) & 255);
    i++;
  }
  throw new StatementFileError('corrupt');
}

function readHexString(text: string, start: number): { bytes: Uint8Array; next: number } {
  const end = text.indexOf('>', start);
  if (end < 0) throw new StatementFileError('corrupt');
  return { bytes: hexToBytes(text.slice(start + 1, end)), next: end + 1 };
}

function skipDict(text: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    if (text.startsWith('<<', i)) {
      depth++;
      i += 2;
      continue;
    }
    if (text.startsWith('>>', i)) {
      depth--;
      i += 2;
      if (depth === 0) return i;
      continue;
    }
    i++;
  }
  return i;
}

function decodeGlyphs(raw: Uint8Array, font: FontDec): string {
  if (font.cmap && font.width >= 2) {
    let text = '';
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const cid = (raw[i] << 8) | raw[i + 1];
      text += font.cmap.get(cid) ?? '\uFFFD';
    }
    return text;
  }
  if (font.cmap) {
    let text = '';
    for (const b of raw) text += font.cmap.get(b) ?? '\uFFFD';
    return text;
  }
  let text = '';
  for (const b of raw) text += String.fromCharCode(b);
  return text;
}

function parseContent(content: string, fonts: Map<string, FontDec>): TextItem[] {
  const items: TextItem[] = [];
  let i = 0;
  const stack: Token[] = [];
  let x = 0;
  let y = 0;
  let font: FontDec = { cmap: null, width: 1 };

  const takeNums = (count: number) => {
    const nums: number[] = [];
    for (let k = stack.length - 1; k >= 0 && nums.length < count; k--) {
      const token = stack[k];
      if (token.t === 'num') nums.push(token.v);
    }
    stack.length = 0;
    return nums.reverse();
  };

  const show = (raw: Uint8Array) => {
    const text = decodeGlyphs(raw, font).replace(/\u0000/g, '');
    if (text.trim()) items.push({ x, y, text });
  };

  while (i < content.length) {
    const c = content[i];
    if (c === '%') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (c === '(') {
      const lit = readLiteral(content, i);
      stack.push({ t: 'bytes', v: lit.bytes });
      i = lit.next;
      continue;
    }
    if (c === '<') {
      if (content[i + 1] === '<') {
        i = skipDict(content, i);
        continue;
      }
      const hex = readHexString(content, i);
      stack.push({ t: 'bytes', v: hex.bytes });
      i = hex.next;
      continue;
    }
    if (c === '[') {
      stack.push({ t: 'arr_s' });
      i++;
      continue;
    }
    if (c === ']') {
      const arr: Token[] = [];
      while (stack.length && stack[stack.length - 1].t !== 'arr_s') arr.push(stack.pop() as Token);
      if (stack.length) stack.pop();
      arr.reverse();
      stack.push({ t: 'arr', v: arr });
      i++;
      continue;
    }
    if (c === '/') {
      const name = /^\/[^\s[\]<>(){}/%]+/.exec(content.slice(i));
      if (!name) {
        i++;
        continue;
      }
      stack.push({ t: 'name', v: name[0].slice(1) });
      i += name[0].length;
      continue;
    }
    const num = /^[-+]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)/.exec(content.slice(i));
    if (num) {
      stack.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const op = /^[A-Za-z*'"]+/.exec(content.slice(i));
    if (!op) {
      i++;
      continue;
    }
    const name = op[0];
    i += name.length;
    if (name === 'Tm') {
      const nums = takeNums(6);
      if (nums.length >= 2) {
        x = nums[nums.length - 2];
        y = nums[nums.length - 1];
      }
    } else if (name === 'Td' || name === 'TD') {
      const nums = takeNums(2);
      if (nums.length === 2) {
        x += nums[0];
        y += nums[1];
      }
    } else if (name === 'T*') {
      y -= 12;
      stack.length = 0;
    } else if (name === 'Tf') {
      const fontName = [...stack].reverse().find((token): token is { t: 'name'; v: string } => token.t === 'name');
      if (fontName) font = fonts.get(fontName.v) ?? font;
      stack.length = 0;
    } else if (name === 'Tj' || name === "'") {
      const raw = [...stack].reverse().find((token) => token.t === 'bytes');
      if (name === "'") y -= 12;
      if (raw && raw.t === 'bytes') show(raw.v);
      stack.length = 0;
    } else if (name === 'TJ') {
      const arr = [...stack].reverse().find((token) => token.t === 'arr');
      if (arr && arr.t === 'arr') {
        const parts: Uint8Array[] = [];
        for (const part of arr.v) if (part.t === 'bytes') parts.push(part.v);
        const total = parts.reduce((sum, part) => sum + part.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const part of parts) {
          merged.set(part, offset);
          offset += part.length;
        }
        show(merged);
      }
      stack.length = 0;
    } else if (name === 'BT' || name === 'ET') {
      stack.length = 0;
    } else if (name === '"' ) {
      const raw = [...stack].reverse().find((token) => token.t === 'bytes');
      if (raw && raw.t === 'bytes') show(raw.v);
      stack.length = 0;
    }
  }
  return items;
}

function mediaBox(header: string): { width: number; height: number } {
  const m = /\/MediaBox\s*\[\s*[\d.+-]+\s+[\d.+-]+\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(header);
  return { width: m ? Number(m[1]) : 595.28, height: m ? Number(m[2]) : 841.89 };
}

function fontMap(header: string, objects: Map<number, PdfObj>): Map<string, FontDec> {
  const fonts = new Map<string, FontDec>();
  const block = /\/Font\s*<<([\s\S]*?)>>/.exec(header);
  if (!block) return fonts;
  for (const ref of block[1].matchAll(/\/(F[A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g)) {
    const fontObj = objects.get(Number(ref[2]));
    const toUnicode = fontObj ? refsOf(fontObj.header, 'ToUnicode')[0] : undefined;
    const cmapObj = toUnicode ? objects.get(toUnicode) : undefined;
    fonts.set(ref[1], cmapObj?.stream ? parseCMap(cmapObj.stream) : { cmap: null, width: 1 });
  }
  return fonts;
}

function walkPages(objects: Map<number, PdfObj>, num: number, out: PdfObj[]): void {
  const obj = objects.get(num);
  if (!obj) return;
  if (isType(obj.header, 'Page')) {
    out.push(obj);
    return;
  }
  if (isType(obj.header, 'Pages') || /\/Kids\s*\[/.test(obj.header)) {
    for (const kid of refsOf(obj.header, 'Kids')) walkPages(objects, kid, out);
  }
}

export async function extractPdfText(file: Uint8Array, options: ExtractOptions = {}): Promise<TextPage[]> {
  const maxPages = options.maxPages ?? STATEMENT_LIMITS.maxPages;
  const objects = indexObjects(file);
  const catalog = [...objects.values()].find((obj) => isType(obj.header, 'Catalog'));
  const pagesRoot = catalog ? refsOf(catalog.header, 'Pages')[0] : undefined;
  const pages: PdfObj[] = [];
  if (pagesRoot) walkPages(objects, pagesRoot, pages);
  if (pages.length === 0) {
    for (const obj of objects.values()) if (isType(obj.header, 'Page')) pages.push(obj);
  }
  if (pages.length === 0) throw new StatementFileError('corrupt');
  if (pages.length > maxPages) throw new StatementFileError('too_many_pages');

  const extracted: TextPage[] = [];
  for (let index = 0; index < pages.length; index++) {
    if (options.signal?.aborted) throw new StatementFileError('cancelled');
    const page = pages[index];
    const fonts = fontMap(page.header, objects);
    const box = mediaBox(page.header);
    const items: TextItem[] = [];
    for (const contentNum of refsOf(page.header, 'Contents')) {
      const content = objects.get(contentNum);
      if (!content?.stream) continue;
      items.push(...parseContent(asLatin1(content.stream), fonts));
    }
    extracted.push({ page: index + 1, width: box.width, height: box.height, items });
    options.onPage?.(index + 1, pages.length);
    if (options.onPage || options.signal) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return extracted;
}

export function countLetters(pages: TextPage[]): number {
  let count = 0;
  for (const page of pages) {
    for (const item of page.items) {
      for (const ch of item.text) if (/\p{L}/u.test(ch)) count++;
    }
  }
  return count;
}
