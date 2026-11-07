import { zlibSync } from 'fflate';
import { formatPdfMoney } from '../money';

// Бүрэн зохиомол Хаан банкны бүтэцтэй PDF. Бодит хуулга, нэр, данс, дүн байхгүй.

export type SyntheticRow = {
  lineNo: number;
  date: string; // YYYY.MM.DD
  time: string;
  openingCents: number;
  amountCents: number;
  note: string;
  noteExtra?: string;
  counterparty?: string;
  page: 1 | 2;
};

export type SyntheticStatement = {
  bytes: Uint8Array;
  rows: SyntheticRow[];
  openingCents: number;
  closingCents: number;
  creditCents: number;
  debitCents: number;
};

const CELLS: { key: string; x: number }[] = [
  { key: 'no', x: 27 },
  { key: 'date', x: 47 },
  { key: 'time', x: 90 },
  { key: 'branch', x: 118 },
  { key: 'open', x: 160 },
  { key: 'amount', x: 240 },
  { key: 'close', x: 330 },
  { key: 'note', x: 373 },
  { key: 'counter', x: 530 },
];

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (ch) => ch.charCodeAt(0));
}

function pdfLiteral(bytes: Uint8Array): string {
  let out = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) out += `\\${b.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(b);
  }
  return `${out})`;
}

function encodeCids(text: string, map: Map<string, number>): Uint8Array {
  const raw: number[] = [];
  for (const ch of text) {
    const cid = map.get(ch);
    if (cid == null) throw new Error(`Синтетик фонтод тэмдэгт алга: ${ch}`);
    raw.push((cid >> 8) & 255, cid & 255);
  }
  return Uint8Array.from(raw);
}

function cmapAndMap(chars: string[]): { compressed: Uint8Array; map: Map<string, number> } {
  const map = new Map<string, number>();
  const lines: string[] = [];
  chars.forEach((ch, index) => {
    const cid = index + 1;
    map.set(ch, cid);
    const src = cid.toString(16).padStart(4, '0');
    const dst = (ch.codePointAt(0) ?? 0).toString(16).padStart(4, '0');
    lines.push(`<${src}><${src}><${dst}>`);
  });
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i += 100) {
    const slice = lines.slice(i, i + 100);
    blocks.push(`${slice.length} beginbfrange\n${slice.join('\n')}\nendbfrange`);
  }
  const body = `begincmap\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${blocks.join('\n')}\nendcmap\n`;
  return { compressed: zlibSync(new TextEncoder().encode(body)), map };
}

type Draw = { x: number; y: number; text: string; page: 1 | 2 };

function content(draws: Draw[], map: Map<string, number>): Uint8Array {
  let body = '';
  for (const draw of draws) {
    body += `BT\n/F1 9 Tf\n1 0 0 1 ${draw.x} ${draw.y} Tm\n${pdfLiteral(encodeCids(draw.text, map))} Tj\nET\n`;
  }
  return zlibSync(new TextEncoder().encode(body));
}

function streamObject(data: Uint8Array): Uint8Array {
  const head = ascii(`<< /Filter /FlateDecode /Length ${data.length}>>stream\n`);
  const tail = ascii('\nendstream');
  const out = new Uint8Array(head.length + data.length + tail.length);
  out.set(head, 0);
  out.set(data, head.length);
  out.set(tail, head.length + data.length);
  return out;
}

function buildPdf(objects: Uint8Array[]): Uint8Array {
  const header = ascii('%PDF-1.4\n');
  const parts: Uint8Array[] = [header];
  const offsets = [0];
  let cursor = header.length;
  objects.forEach((body, index) => {
    offsets.push(cursor);
    const prefix = ascii(`${index + 1} 0 obj\n`);
    const suffix = ascii('\nendobj\n');
    parts.push(prefix, body, suffix);
    cursor += prefix.length + body.length + suffix.length;
  });
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;
  parts.push(ascii(xref));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function buildSyntheticStatement(): SyntheticStatement {
  const opening = 10_000_000; // 100,000.00
  const specs: Omit<SyntheticRow, 'openingCents'>[] = [
    { lineNo: 1, date: '2026.01.03', time: '09:15', amountCents: -150_050, note: 'Кофе шоп', page: 1 },
    { lineNo: 2, date: '2026.01.03', time: '09:15', amountCents: -150_050, note: 'Кофе шоп', page: 1 },
    { lineNo: 3, date: '2026.01.05', time: '08:01', amountCents: 80_000_000, note: '1-р сарын цалин', counterparty: '1100000001', page: 1 },
    { lineNo: 4, date: '2026.01.06', time: '12:00', amountCents: -20_000_000, note: 'Данс хооронд өөрийн данс', page: 1 },
    { lineNo: 5, date: '2026.01.07', time: '12:30', amountCents: -5_000_000, note: 'Хадгаламж руу', page: 1 },
    { lineNo: 6, date: '2026.01.08', time: '15:45', amountCents: 250_000, note: 'Пос буцаалт', page: 1 },
    { lineNo: 7, date: '2026.01.09', time: '16:10', amountCents: -320_075, note: 'Номын дэлгүүр', noteExtra: 'сурах бичиг', page: 1 },
    { lineNo: 8, date: '2026.01.10', time: '18:00', amountCents: -10_000, note: 'Янз бүрийн лавлагаа 55001122', page: 1 },
    { lineNo: 9, date: '2026.01.12', time: '11:11', amountCents: -4_500_000, note: 'Цахилгаан төлбөр', page: 2 },
  ];

  const rows: SyntheticRow[] = [];
  let balance = opening;
  for (const spec of specs) {
    const row: SyntheticRow = { ...spec, openingCents: balance };
    balance += spec.amountCents;
    rows.push(row);
  }
  const closing = balance;
  let creditCents = 0;
  let debitCents = 0;
  for (const row of rows) {
    if (row.amountCents > 0) creditCents += row.amountCents;
    else debitCents += Math.abs(row.amountCents);
  }

  const draws: Draw[] = [
    { page: 1, x: 40, y: 800, text: 'Хаан банк дансны хуулга' },
    { page: 1, x: 40, y: 780, text: 'Валют' },
    { page: 1, x: 120, y: 780, text: 'MNT' },
    { page: 1, x: 40, y: 760, text: 'IBAN' },
    { page: 1, x: 120, y: 760, text: 'MN009999000000000019' },
    { page: 1, x: 40, y: 740, text: 'Хугацаа' },
    { page: 1, x: 120, y: 740, text: '2026.01.01-2026.01.31' },
    { page: 1, x: 27, y: 720, text: '№' },
    { page: 1, x: 47, y: 720, text: 'Огноо' },
    { page: 1, x: 90, y: 720, text: 'Цаг' },
    { page: 1, x: 118, y: 720, text: 'Салбар' },
    { page: 1, x: 160, y: 720, text: 'Эхний үлдэгдэл' },
    { page: 1, x: 240, y: 720, text: 'Гүйлгээ' },
    { page: 1, x: 330, y: 720, text: 'Эцсийн үлдэгдэл' },
    { page: 1, x: 373, y: 720, text: 'Гүйлгээний утга' },
    { page: 1, x: 530, y: 720, text: 'Данс' },
  ];

  for (const row of rows) {
    const y = row.page === 1 ? 680 - (row.lineNo - 1) * 28 : 760;
    const close = row.openingCents + row.amountCents;
    const values: Record<string, string> = {
      no: String(row.lineNo),
      date: row.date,
      time: row.time,
      branch: '5001',
      open: formatPdfMoney(row.openingCents),
      amount: formatPdfMoney(row.amountCents),
      close: formatPdfMoney(close),
      note: row.note,
      counter: row.counterparty ?? '',
    };
    for (const cell of CELLS) {
      if (!values[cell.key]) continue;
      draws.push({ page: row.page, x: cell.x, y, text: values[cell.key] });
    }
    if (row.noteExtra) draws.push({ page: row.page, x: 373, y: y - 12, text: row.noteExtra });
  }

  draws.push(
    { page: 2, x: 40, y: 120, text: 'Нийт дүн' },
    { page: 2, x: 220, y: 120, text: formatPdfMoney(creditCents) },
    { page: 2, x: 300, y: 120, text: formatPdfMoney(debitCents) },
    { page: 1, x: 20, y: 12, text: 'Хаан банк' },
    { page: 1, x: 520, y: 12, text: 'Хуудас' },
    { page: 1, x: 560, y: 12, text: '1' },
    { page: 2, x: 20, y: 12, text: 'Хаан банк' },
    { page: 2, x: 520, y: 12, text: 'Хуудас' },
    { page: 2, x: 560, y: 12, text: '2' },
  );

  const chars = [...new Set(draws.map((draw) => [...draw.text]).flat())];
  const { compressed, map } = cmapAndMap(chars);
  const page1 = content(draws.filter((draw) => draw.page === 1), map);
  const page2 = content(draws.filter((draw) => draw.page === 2), map);

  const objects = [
    ascii('<< /Type /Catalog /Pages 2 0 R >>'),
    ascii('<< /Type /Pages /Count 2 /Kids [3 0 R 5 0 R] >>'),
    ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.88] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>'),
    streamObject(page1),
    ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.88] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>'),
    streamObject(page2),
    ascii('<< /Type /Font /Subtype /Type0 /BaseFont /Synthetic /Encoding /Identity-H /ToUnicode 8 0 R >>'),
    streamObject(compressed),
  ];

  return { bytes: buildPdf(objects), rows, openingCents: opening, closingCents: closing, creditCents, debitCents };
}

export function buildBlankPdf(): Uint8Array {
  const contentBytes = zlibSync(new TextEncoder().encode('BT\nET\n'));
  const objects = [
    ascii('<< /Type /Catalog /Pages 2 0 R >>'),
    ascii('<< /Type /Pages /Count 1 /Kids [3 0 R] >>'),
    ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.88] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'),
    streamObject(contentBytes),
    ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
  ];
  return buildPdf(objects);
}
