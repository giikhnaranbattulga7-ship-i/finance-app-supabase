import { assertNever } from '../assertNever';

// Мөнгөний чиглэл (орлого/зарлага) ба эдийн засгийн утгыг тусад нь ялгана.
// Их дүнгээр ангилахгүй: том гүйлгээ дангаараа цалин, түрээс биш.
export type EconomicKind = 'normal' | 'transfer' | 'savings' | 'refund' | 'unclassified';
export type CashDirection = 'in' | 'out';
export type Confidence = 'high' | 'low' | 'none';

export type Classification = {
  kind: EconomicKind;
  categoryName: string | null;
  confidence: Confidence;
  reason: string;
};

export const KIND_LABEL: Record<EconomicKind, string> = {
  normal: 'Тайланд орно',
  transfer: 'Шилжүүлэг',
  savings: 'Хадгаламж',
  refund: 'Буцаалт',
  unclassified: 'Ангилаагүй',
};

export function kindLabel(kind: EconomicKind): string {
  switch (kind) {
    case 'normal':
    case 'transfer':
    case 'savings':
    case 'refund':
    case 'unclassified':
      return KIND_LABEL[kind];
    default:
      return assertNever(kind);
  }
}

export function normalizeNote(note: string): string {
  return note.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

// categoryName нь seed.sql-ийн үндсэн ангиллын нэртэй яг таарна.
export function classifyNote(note: string, direction: CashDirection): Classification {
  const text = normalizeNote(note);

  if (has(text, /буцаалт|буцаав|буцаан олголт|\brefund\b|\breversal\b/)) {
    if (direction === 'in') {
      return { kind: 'refund', categoryName: null, confidence: 'high', reason: 'Буцаалт гэсэн үгтэй, мөнгө орж ирсэн.' };
    }
    return {
      kind: 'unclassified',
      categoryName: null,
      confidence: 'low',
      reason: 'Буцаалт гэсэн үгтэй ч мөнгө гарсан тул автоматаар ангилаагүй.',
    };
  }

  if (has(text, /хадгаламжийн хүү|хүүгийн орлого|\binterest\b/)) {
    if (direction === 'in') {
      return { kind: 'normal', categoryName: 'Бусад орлого', confidence: 'high', reason: 'Хүүгийн орлого. Хадгаламж руу шилжүүлэг биш.' };
    }
    return { kind: 'unclassified', categoryName: null, confidence: 'low', reason: 'Хүү гэсэн үгтэй ч мөнгө гарсан.' };
  }

  if (has(text, /хадгаламж|хуримтлал|\bsavings\b/) && !has(text, /хүү/)) {
    return { kind: 'savings', categoryName: null, confidence: 'high', reason: 'Хадгаламж руу орсон эсвэл гарсан. Зарлага/орлогонд тооцохгүй.' };
  }

  if (has(text, /данс хооронд|өөрийн данс|internal transfer|own account/)) {
    return { kind: 'transfer', categoryName: null, confidence: 'high', reason: 'Данс хоорондын шилжүүлэг. Үлдэгдэлд орно, зарлагад орохгүй.' };
  }

  if (has(text, /шилжүүлэг|\btransfer\b/)) {
    return {
      kind: 'unclassified',
      categoryName: null,
      confidence: 'low',
      reason: 'Шилжүүлэг гэсэн үг байна. Өөрийн данс уу, өөр хүнд төлбөр үү гэдэг нь тодорхойгүй.',
    };
  }

  if (has(text, /цалин|\bpayroll\b|\bsalary\b/)) {
    return direction === 'in'
      ? { kind: 'normal', categoryName: 'Цалин', confidence: 'high', reason: 'Цалин гэсэн үгтэй.' }
      : { kind: 'unclassified', categoryName: null, confidence: 'low', reason: 'Цалин гэсэн үгтэй ч мөнгө гарсан.' };
  }
  if (has(text, /тэтгэлэг|стипенд|scholarship/)) {
    return direction === 'in'
      ? { kind: 'normal', categoryName: 'Тэтгэлэг', confidence: 'high', reason: 'Тэтгэлэг гэсэн үгтэй.' }
      : { kind: 'unclassified', categoryName: null, confidence: 'low', reason: 'Тэтгэлгийн үгтэй ч мөнгө гарсан.' };
  }
  if (has(text, /бэлэг|\bgift\b/)) {
    return direction === 'in'
      ? { kind: 'normal', categoryName: 'Бэлэг', confidence: 'high', reason: 'Бэлэг гэсэн үгтэй.' }
      : { kind: 'unclassified', categoryName: null, confidence: 'low', reason: 'Бэлэг гэсэн үгтэй ч мөнгө гарсан тул ангилаагүй.' };
  }

  const expenseRules: { pattern: RegExp; categoryName: string; reason: string }[] = [
    { pattern: /түрээс|байрны түрээс|\brent\b/, categoryName: 'Түрээс', reason: 'Түрээс гэсэн үгтэй.' },
    { pattern: /цахилгаан|дулаан|интернет|утасны төлбөр|сүлжээний|unitel|mobicom|skytel|юнител|мобиком/, categoryName: 'Төлбөр', reason: 'Үйлчилгээний төлбөр гэсэн үгтэй.' },
    { pattern: /таксы|такси|\buber\b|\bgrab\b|бензин|шатахуун|автобус|зогсоол|\bparking\b/, categoryName: 'Тээвэр', reason: 'Тээвэр гэсэн үгтэй.' },
    { pattern: /эмнэлэг|эм тариа|аптек|\bpharmacy\b|эрүүл мэнд/, categoryName: 'Эрүүл мэнд', reason: 'Эрүүл мэнд гэсэн үгтэй.' },
    { pattern: /сургалт|сургууль|сурах бичиг|номын|\btuition\b/, categoryName: 'Боловсрол', reason: 'Боловсрол гэсэн үгтэй.' },
    { pattern: /хувцас|гутал/, categoryName: 'Хувцас', reason: 'Хувцас гэсэн үгтэй.' },
    { pattern: /хүнс|зоог|ресторан|кофе|кафе|\bcoffee\b|пицца|\bpizza\b|супермаркет|мини маркет/, categoryName: 'Хоол хүнс', reason: 'Хоол, хүнс гэсэн үгтэй.' },
    { pattern: /\bnetflix\b|\bspotify\b|кино театр|тоглоомын/, categoryName: 'Зугаа цэнгэл', reason: 'Зугаа цэнгэл гэсэн үгтэй.' },
  ];

  if (direction === 'out') {
    for (const rule of expenseRules) {
      if (has(text, rule.pattern)) {
        return { kind: 'normal', categoryName: rule.categoryName, confidence: 'high', reason: rule.reason };
      }
    }
  }

  return {
    kind: 'unclassified',
    categoryName: null,
    confidence: 'none',
    reason: 'Танигдах үг олдсонгүй. Та өөрөө ангилна уу. Дүнгээр нь таамаглаагүй.',
  };
}
