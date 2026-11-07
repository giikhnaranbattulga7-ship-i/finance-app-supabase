// Хуулгын эхний үлдэгдлийг дансны initial_balance болгох эсэх.
// Байгаа үлдэгдлийг чимээгүй дарж болохгүй, эхний үлдэгдлийг гүйлгээ болгон давхар тоолохгүй.

export type OpeningPlan =
  | { action: 'set'; previousCents: number; nextCents: number }
  | { action: 'unchanged'; reason: 'matches' | 'declined' | 'zero' }
  | { action: 'locked'; reason: 'has_transactions' | 'differs' };

export function planOpening(input: {
  initialCents: number;
  transactionCount: number;
  statementOpeningCents: number;
  userWantsApply: boolean;
}): OpeningPlan {
  if (input.transactionCount > 0) return { action: 'locked', reason: 'has_transactions' };
  if (input.initialCents !== 0 && input.initialCents !== input.statementOpeningCents) {
    return { action: 'locked', reason: 'differs' };
  }
  if (!input.userWantsApply) return { action: 'unchanged', reason: 'declined' };
  if (input.initialCents === input.statementOpeningCents) return { action: 'unchanged', reason: 'matches' };
  if (input.statementOpeningCents === 0) return { action: 'unchanged', reason: 'zero' };
  return { action: 'set', previousCents: input.initialCents, nextCents: input.statementOpeningCents };
}
