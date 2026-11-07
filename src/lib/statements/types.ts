import { CashDirection, Confidence, EconomicKind } from './classify';

export type DraftRow = {
  id: string;
  page: number;
  lineNo: number | null;
  occurredAt: string;
  postedTime: string;
  openingCents: number | null;
  amountCents: number | null;
  closingCents: number | null;
  note: string;
  kind: EconomicKind;
  categoryName: string | null;
  confidence: Confidence;
  reason: string;
  excluded: boolean;
  issues: string[];
  // Зөвхөн танигдаагүй мөрийг дэлгэцэнд харуулах товч текст. Логт хэвлэхгүй.
  sourcePreview: string;
};

export type ParsedStatement = {
  bank: 'khan_bank';
  currency: string;
  maskedAccount: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  openingCents: number | null;
  closingCents: number | null;
  rows: DraftRow[];
  warnings: string[];
  pageCount: number;
  wrappedRowCount: number;
  chainOk: boolean;
  totalsOk: boolean | null;
};

export type CommitRow = {
  occurredAt: string;
  postedTime: string;
  direction: CashDirection;
  amountCents: number;
  balanceAfterCents: number;
  note: string;
  kind: EconomicKind;
  categoryName: string | null;
  occ: number;
  exclude: boolean;
};
