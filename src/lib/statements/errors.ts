import { assertNever } from '../assertNever';

export type StatementErrorCode =
  | 'too_large'
  | 'too_many_pages'
  | 'too_many_rows'
  | 'encrypted'
  | 'corrupt'
  | 'scanned'
  | 'unsupported'
  | 'empty'
  | 'cancelled';

const MESSAGES: Record<StatementErrorCode, string> = {
  too_large: 'Файл 8 МБ-аас их байна. Хуулгаа богино хугацаагаар татаж дахин оруулна уу.',
  too_many_pages: 'Хуулга 25 хуудаснаас урт байна. Хугацааг хувааж татна уу.',
  too_many_rows: 'Нэг хуулганд 2500-аас олон гүйлгээ байна. Хугацааг хувааж оруулна уу.',
  encrypted: 'Энэ PDF нууц үгээр түгжигдсэн байна. Банкны аппаас нууц үггүй текст хуулга татна уу.',
  corrupt: 'PDF гэмтсэн эсвэл PDF биш байна. Файлаа дахин татаад оруулна уу.',
  scanned: 'Зурган эсвэл сканнердсан PDF байна. Текст нь сонгогддог Хаан банкны хуулга хэрэгтэй. Зургаас мөр танихгүй.',
  unsupported: 'Одоогоор зөвхөн Хаан банкны текст дансны хуулгыг уншина. Бусад банк, зурган PDF, Excel-ийг автоматаар ойлгохгүй.',
  empty: 'Хуулганд оруулах гүйлгээ олдсонгүй. Эхний болон эцсийн үлдэгдэл л байгаа эсэхийг шалгана уу.',
  cancelled: 'Уншихыг зогсоолоо.',
};

export class StatementFileError extends Error {
  readonly code: StatementErrorCode;

  constructor(code: StatementErrorCode) {
    super(MESSAGES[code]);
    this.name = 'StatementFileError';
    this.code = code;
  }
}

export function statementErrorText(code: StatementErrorCode): string {
  switch (code) {
    case 'too_large':
    case 'too_many_pages':
    case 'too_many_rows':
    case 'encrypted':
    case 'corrupt':
    case 'scanned':
    case 'unsupported':
    case 'empty':
    case 'cancelled':
      return MESSAGES[code];
    default:
      return assertNever(code);
  }
}
