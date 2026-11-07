// Хуулгын шинэчлэл хийгдээгүй сангийн алдааг оюутанд ойлгомжтой болгоно.
export function friendlyDbError(message: string): string {
  if (/commit_statement_import|preview_statement_duplicates|rollback_statement_import|statement_imports|economic_kind|fingerprint_base|column .* does not exist|could not find the function/i.test(message)) {
    return 'Хуулгын өгөгдлийн сангийн шинэчлэл хараахан хийгдээгүй байна. supabase/migrations/20261107_statement_import.sql файлыг Supabase SQL Editor дээр ажиллуулна уу. Production дээр автоматаар ажиллуулаагүй.';
  }
  return message;
}
