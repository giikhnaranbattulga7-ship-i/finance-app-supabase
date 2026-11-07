import { countLetters, extractPdfText, ExtractOptions } from '../pdf/extractText';
import { StatementFileError } from './errors';
import { parseKhanStatement } from './khanBank';
import { STATEMENT_LIMITS } from './limits';
import { ParsedStatement } from './types';

export type ParseOptions = ExtractOptions;

// Файлыг төхөөрөмж дээр уншина. Гадаад AI, гуравдагч сервер рүү илгээхгүй.
export async function parseStatementFile(bytes: Uint8Array, options: ParseOptions = {}): Promise<ParsedStatement> {
  if (bytes.byteLength === 0) throw new StatementFileError('corrupt');
  if (bytes.byteLength > STATEMENT_LIMITS.maxBytes) throw new StatementFileError('too_large');
  const pages = await extractPdfText(bytes, { maxPages: STATEMENT_LIMITS.maxPages, ...options });
  if (countLetters(pages) < 12) throw new StatementFileError('scanned');
  return parseKhanStatement(pages);
}
