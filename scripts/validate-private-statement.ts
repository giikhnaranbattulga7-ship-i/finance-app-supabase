/// <reference types="node" />
// Бодит хуулгыг ЗӨВХӨН локал шалгана. Мөр, нэр, данс, дүн, утгыг хэвлэхгүй.
// Жишээ: node --import tsx scripts/validate-private-statement.ts /path/file.pdf
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStatementFile } from '../src/lib/statements/parseStatement';

const filePath = process.argv[2];
if (!filePath) {
  console.error('path required');
  process.exit(2);
}
const abs = resolve(filePath);
const repo = resolve(process.cwd());
if (abs.startsWith(`${repo}/`)) {
  console.error('refusing to validate a file inside the git repo');
  process.exit(2);
}

const bytes = new Uint8Array(readFileSync(abs));
async function main() {
 try {
  const parsed = await parseStatementFile(bytes);
  const issueRows = parsed.rows.filter((row) => row.issues.length > 0).length;
  const report = {
    bytes: bytes.byteLength,
    pages: parsed.pageCount,
    rows: parsed.rows.length,
    issueRows,
    wrappedRows: parsed.wrappedRowCount,
    chainOk: parsed.chainOk,
    totalsOk: parsed.totalsOk,
    openingEqualsFirst: parsed.openingCents != null,
    closingEqualsLast: parsed.closingCents != null,
    movementMatches: parsed.chainOk,
    currencyKnown: parsed.currency.length === 3,
    accountMasked: parsed.maskedAccount == null || /^\*{4}\d{4}$/.test(parsed.maskedAccount),
    warningCount: parsed.warnings.length,
    kinds: parsed.rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.kind] = (acc[row.kind] ?? 0) + 1;
      return acc;
    }, {}),
  };
  console.log(JSON.stringify(report));
  process.exit(parsed.chainOk && issueRows === 0 ? 0 : 1);
} catch (error) {
  const code = error instanceof Error && 'code' in error ? String((error as { code: string }).code) : 'error';
  console.log(JSON.stringify({ failed: code }));
  process.exit(1);
 }
}
void main();
