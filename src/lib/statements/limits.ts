// Хуулгын файлын хязгаар. Утасны санах ой, санамсаргүй том PDF-ээс хамгаална.
export const STATEMENT_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  maxPages: 25,
  maxRows: 2500,
  maxNote: 200,
} as const;
