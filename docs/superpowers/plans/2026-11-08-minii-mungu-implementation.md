# Миний мөнгө Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing manual finance app into «Миний мөнгө» with three tabs and currency-safe totals, without a database migration.

**Architecture:** Pure functions in `src/lib/finance.ts` own rounding, local dates, MNT partitions, and budget remaining. Screens call the existing Supabase services. `monthSummary` joins `accounts.currency` and ignores non-MNT rows for the MNT net and category spend.

**Tech Stack:** Expo ~58.0.17, React Native 0.88.1, React 19.3.0, Expo Router ~58.0.25, TypeScript ~6.0.3, Supabase JS ^2.119.0. Tests: `node --experimental-strip-types --test`.

## Global Constraints

- Branch `cursor/minii-mungu-design-69fa` only. Do not touch `cursor/statement-pdf-import-69fa` or PR #1.
- No migration. Eight tables stay. `amount` and `initial_balance` stay `numeric(14,2)`. `occurred_at` stays `date`. `accounts.currency` default `'MNT'`.
- Do not run `scripts/rls-test.mjs` against `rahymsygjwytwludoucq`. The script must exit if that host appears.
- Three labeled numbers: Нийт үлдэгдэл, Энэ сарын цэвэр, Төсвөөс үлдсэн. Never call any of them spendable money.
- Sum only matching currencies. No FX.
- No budgets means «Төсөв алга», not 0.
- Round half up so 0.005 becomes 0.01. Reject values above 999999999999.99.
- Dates are local calendar dates. Do not parse `YYYY-MM-DD` with `new Date(iso)`.
- Colors: bg `#000000`, card `#121212`, text `#FFFFFF`, muted `#8A8A8A`, accent `#00BA7C`. Primary button text is `#000000`. No white text on green. Over budget uses `−` and «Хэтэрсэн».
- Tabs: Нүүр, Гүйлгээ, Төсөв. Accounts, categories, tags, logout, admin stay on profile. Admin only when `role === 'admin'`.
- Note max 200. Tags remain optional N:M. Delete still confirms.
- No PDF, OCR, payment, bank sync, push, camera, or EAS.
- Do not claim Figma, Expo Go, or a live authenticated save unless it actually happened.

## File map

- Create `src/lib/finance.ts` — rounding, dates, currency totals, budget progress, month groups.
- Create `src/lib/finance.test.ts` — pure tests.
- Modify `src/lib/theme.ts` — palette. `onAccent` is `#000000`.
- Modify `src/lib/format.ts` — two-decimal display and date-only formatting.
- Modify `src/lib/validation.ts` — local today, money max, store rounding.
- Modify `src/services/transactions.ts` — MNT-only month summary via account currency.
- Modify `src/types/database.ts` — account join includes `currency`.
- Modify tabs, home, transactions, budgets, profile, transaction form, Button, Fab, Chip, ProgressBar, Input, Screen consumers.
- Modify `scripts/rls-test.mjs` — refuse the live project ref.
- Modify `README.md` — run steps, sources, traceability. No secrets.
- Create `src/app/preview-synthetic.tsx` — labeled unsaved fixture for screenshots.

### Task 1: Pure money and dates

**Files:** Create `src/lib/finance.ts`, `src/lib/finance.test.ts`. Modify `package.json` script `test`.

**Interfaces:**
- `roundToCents(amount: number): number`
- `MAX_MONEY = 999999999999.99`
- `localTodayISO(now?: Date): string`
- `parseIsoDate(iso: string): { year: number; month: number; day: number } | null`
- `nextMonthStart(monthStart: string): string`
- `sumByCurrency(rows: { currency: string; amount: number }[]): { currency: string; total: number }[]`
- `monthlyNet(rows: { type: 'income' | 'expense'; amount: number; currency: string }[]): { income: number; expense: number; net: number }`
- `budgetRemaining(lines: { limit: number; spent: number }[]): { total: number | null; lines: { limit: number; spent: number; remaining: number; over: boolean }[] }`

- [ ] Write tests for 0.005 → 0.01, max overflow, local date, month window without UTC shift, MNT not mixed with USD, empty budget is null, negative remaining is over.
- [ ] Run `node --experimental-strip-types --test src/lib/finance.test.ts` and expect pass.
- [ ] Commit.

### Task 2: Theme, services, and screens

**Consumes:** Task 1 functions.

**Produces:** Three-tab UI, MNT totals, budget rows with «Хэтэрсэн», form that stores rounded money and local today.

- [ ] Point `monthSummary` at `account:accounts(currency)` and keep only `MNT` in income, expense, and `byCategory`.
- [ ] Home shows the three labels, other currencies grouped, last 5 transactions, one + button, profile header button.
- [ ] Hide Данс and Профайл from the tab bar. Add Данс to the profile menu.
- [ ] Budget list uses `budgetRemaining`. Empty copy is «Төсөв алга».
- [ ] Transaction form sorts accounts by name, blocks missing account or category, note length 200, rounds before save.
- [ ] Primary controls use black text on green. Touch targets at least 48.
- [ ] Commit.

### Task 3: Safety, docs, and evidence

- [ ] `scripts/rls-test.mjs` exits if the URL contains `rahymsygjwytwludoucq`.
- [ ] README states the goal, run command, design sources, and that Figma, Expo Go, and live save were not verified in this change.
- [ ] Export web and screenshot login plus the synthetic preview at desktop and 390px. Label them synthetic.
- [ ] Run typecheck, unit tests, and web export.
- [ ] Commit and update PR #2 only.

## Self-review

Spec sections 3–10 map to Tasks 1–3. No new table. Currency partition is explicit. Empty budget is `null`, not zero. Contrast pairs are the measured ones from the spec. Documentation before defense is README plus ERD already on `main`; Figma and PPT stay with the parent after this QA. No placeholders remain in the task interfaces.
