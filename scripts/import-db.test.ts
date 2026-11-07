/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { sha256Hex, sha256HexBytes } from '../src/lib/sha256';
import { centsToDb } from '../src/lib/money';
import { buildSyntheticStatement } from '../src/lib/pdf/syntheticStatement';
import { buildCommitRows } from '../src/lib/statements/commitRows';
import { parseStatementFile } from '../src/lib/statements/parseStatement';
import { Category } from '../src/types/database';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

async function boot(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb
    );
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    end $$;
    grant usage on schema public to authenticated, anon;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  const schema = readFileSync('supabase/schema.sql', 'utf8').replace(/create extension if not exists ["']?pgcrypto["']?;/gi, '');
  await db.exec(schema);
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${USER_A}', 'a@example.test', '{"full_name":"Анх"}'),
      ('${USER_B}', 'b@example.test', '{"full_name":"Бат"}');
  `);
  return db;
}

async function asUser<T>(db: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('begin');
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', true)`);
  await db.exec('set local role authenticated');
  try {
    const value = await fn();
    await db.exec('commit');
    return value;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

type Commit = {
  import_id: string;
  already_imported: boolean;
  inserted: number;
  duplicates: number;
  excluded: number;
  applied_opening: boolean;
};

async function commit(db: PGlite, accountId: string, hash: string, rows: unknown[], apply = false, opening = '100000.00') {
  const result = await db.query<{ result: Commit }>(
    `select public.commit_statement_import($1,$2,$3,'MNT','2026-01-01','2026-01-31',$4,'96999.00','****0019',$5,$6::jsonb) as result`,
    [accountId, 'synthetic.pdf', hash, opening, apply, JSON.stringify(rows)],
  );
  return result.rows[0].result;
}

test('import commit is idempotent, isolated, and atomic', async () => {
  const db = await boot();
  const category = await db.query<{ id: string }>(`select id from public.categories where name = 'Хоол хүнс' limit 1`);
  const categoryId = category.rows[0].id;
  const hashA = sha256Hex('synthetic-file-a');
  const hashB = sha256Hex('synthetic-file-b');
  const coffee = (balance: number, occ = 0) => ({
    occurred_at: '2026-01-03', posted_time: '09:15', direction: 'out', amount_cents: 150050,
    balance_after_cents: balance, note: 'Кофе шоп', kind: 'normal', category_id: categoryId, occ, exclude: false,
  });

  const accountId = await asUser(db, USER_A, async () => {
    const created = await db.query<{ id: string }>(
      `insert into public.accounts (user_id, name, type, initial_balance) values (auth.uid(), 'Хуулгын данс', 'bank', 0) returning id`,
    );
    return created.rows[0].id;
  });

  const first = await asUser(db, USER_A, () => commit(db, accountId, hashA, [coffee(9849950), coffee(9699900)], true));
  assert.equal(first.inserted, 2);
  assert.equal(first.duplicates, 0);
  assert.equal(first.applied_opening, true);

  const again = await asUser(db, USER_A, () => commit(db, accountId, hashA, [coffee(9849950), coffee(9699900)], false));
  assert.equal(again.already_imported, true);
  assert.equal(again.inserted, 0);

  const overlap = await asUser(db, USER_A, () => commit(db, accountId, hashB, [coffee(9849950)], false));
  assert.equal(overlap.inserted, 0);
  assert.equal(overlap.duplicates, 1);

  const stored = await db.query<{ fingerprint_base: string; initial_balance: string; balance: string }>(`
    select t.fingerprint_base, a.initial_balance::text, v.balance::text
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    join public.account_balances v on v.id = a.id
    where t.account_id = $1
    order by t.balance_after
  `, [accountId]);
  assert.equal(stored.rows.length, 2);
  assert.equal(stored.rows[0].fingerprint_base, sha256Hex('2026-01-03|09:15|out|150050|9699900'));
  assert.equal(stored.rows[0].initial_balance, '100000.00');
  // 100000.00 - 1500.50 - 1500.50 = 96999.00. Шилжүүлэг биш тул зарлагаар хасагдана.
  assert.equal(stored.rows[0].balance, '96999.00');

  await asUser(db, USER_A, async () => {
    await db.query(
      `insert into public.transactions (user_id, account_id, type, amount, note, occurred_at) values (auth.uid(), $1, 'expense', 10, 'гараар', '2026-02-01')`,
      [accountId],
    );
    const rolled = await db.query<{ result: { deleted: number } }>(
      `select public.rollback_statement_import($1) as result`,
      [first.import_id],
    );
    assert.equal(rolled.rows[0].result.deleted, 2);
  });
  const left = await db.query<{ note: string; initial_balance: string }>(
    `select t.note, a.initial_balance::text from public.transactions t join public.accounts a on a.id = t.account_id where t.account_id = $1`,
    [accountId],
  );
  assert.deepEqual(left.rows.map((row) => row.note), ['гараар']);
  assert.equal(left.rows[0].initial_balance, '0.00');

  await assert.rejects(asUser(db, USER_B, async () => {
    await db.query(`select public.rollback_statement_import($1)`, [first.import_id]);
  }));
  const hidden = await asUser(db, USER_B, async () => db.query(`select id from public.statement_imports`));
  assert.equal(hidden.rows.length, 0);
  const hiddenTx = await asUser(db, USER_B, async () => db.query(`select id from public.transactions`));
  assert.equal(hiddenTx.rows.length, 0);

  const locked = await asUser(db, USER_A, async () => {
    const other = await db.query<{ id: string }>(
      `insert into public.accounts (user_id, name, type, initial_balance) values (auth.uid(), 'Бэлэн', 'cash', 5000) returning id`,
    );
    return other.rows[0].id;
  });
  await assert.rejects(
    asUser(db, USER_A, () => commit(db, locked, sha256Hex('locked'), [coffee(1)], true, '100000.00')),
    (error: unknown) => error instanceof Error && error.message.includes('Эхний үлдэгдлийг өөрчлөхгүй'),
  );
  const unchanged = await db.query<{ initial_balance: string }>(`select initial_balance::text from public.accounts where id = $1`, [locked]);
  assert.equal(unchanged.rows[0].initial_balance, '5000.00');

  await db.exec(`
    create or replace function public.fail_marked_note() returns trigger language plpgsql as $$
    begin
      if new.note = 'FAIL' then raise exception 'forced failure'; end if;
      return new;
    end $$;
    create trigger transactions_fail_marked before insert on public.transactions
      for each row execute function public.fail_marked_note();
  `);
  const atomicAccount = await asUser(db, USER_A, async () => {
    const created = await db.query<{ id: string }>(
      `insert into public.accounts (user_id, name, type, initial_balance) values (auth.uid(), 'Атом', 'bank', 0) returning id`,
    );
    return created.rows[0].id;
  });
  await assert.rejects(asUser(db, USER_A, () => commit(db, atomicAccount, sha256Hex('atomic'), [
    coffee(9849950),
    { ...coffee(9699900), note: 'FAIL', occ: 0 },
  ], true)));
  const atomicLeft = await db.query<{ n: string; initial_balance: string }>(`
    select count(t.id)::text as n, a.initial_balance::text
    from public.accounts a
    left join public.transactions t on t.account_id = a.id
    where a.id = $1
    group by a.initial_balance
  `, [atomicAccount]);
  assert.equal(atomicLeft.rows[0].n, '0');
  assert.equal(atomicLeft.rows[0].initial_balance, '0.00');
  await db.close();
});

test('synthetic PDF journey: correct, save, report, replay, rollback keeps manual row', async () => {
  const db = await boot();
  const categories = (await db.query<Category>(
    `select id, user_id, name, type, icon, color from public.categories`,
  )).rows;
  const food = categories.find((category) => category.name === 'Хоол хүнс' && category.type === 'expense');
  assert.ok(food);

  const built = buildSyntheticStatement();
  const parsed = await parseStatementFile(built.bytes);
  assert.equal(parsed.chainOk, true);
  const corrected = parsed.rows.map((row) => {
    if (row.note.includes('Янз бүрийн')) {
      return { ...row, kind: 'normal' as const, categoryName: 'Хоол хүнс', confidence: 'high' as const };
    }
    return row;
  });
  assert.equal(corrected.find((row) => row.note.includes('Янз бүрийн'))?.kind, 'normal');
  const payload = buildCommitRows(corrected, categories);
  const fileHash = sha256HexBytes(built.bytes);

  const accountId = await asUser(db, USER_A, async () => {
    const created = await db.query<{ id: string }>(
      `insert into public.accounts (user_id, name, type, initial_balance) values (auth.uid(), 'Синтетик данс', 'bank', 0) returning id`,
    );
    return created.rows[0].id;
  });

  const saved = await asUser(db, USER_A, () => db.query<{ result: Commit }>(
    `select public.commit_statement_import($1,'synthetic-khan.pdf',$2,'MNT',$3,$4,$5,$6,'****0019',true,$7::jsonb) as result`,
    [
      accountId,
      fileHash,
      parsed.periodStart,
      parsed.periodEnd,
      centsToDb(parsed.openingCents ?? 0),
      centsToDb(parsed.closingCents ?? 0),
      JSON.stringify(payload),
    ],
  ).then((res) => res.rows[0].result));
  assert.equal(saved.already_imported, false);
  assert.equal(saved.inserted, corrected.filter((row) => !row.excluded).length);
  assert.equal(saved.applied_opening, true);

  const report = await db.query<{ income: string; expense: string; transfer: string }>(`
    select
      coalesce(sum(amount) filter (where type = 'income' and economic_kind = 'normal'), 0)::text as income,
      coalesce(sum(amount) filter (where type = 'expense' and economic_kind = 'normal'), 0)::text as expense,
      coalesce(sum(amount) filter (where economic_kind = 'transfer'), 0)::text as transfer
    from public.transactions where account_id = $1
  `, [accountId]);
  const normalExpense = corrected
    .filter((row) => row.kind === 'normal' && (row.amountCents ?? 0) < 0)
    .reduce((sum, row) => sum + Math.abs(row.amountCents ?? 0), 0);
  const normalIncome = corrected
    .filter((row) => row.kind === 'normal' && (row.amountCents ?? 0) > 0)
    .reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  assert.equal(report.rows[0].expense, centsToDb(normalExpense));
  assert.equal(report.rows[0].income, centsToDb(normalIncome));
  assert.equal(report.rows[0].transfer, '200000.00');
  assert.notEqual(report.rows[0].expense, centsToDb(normalExpense + 20_000_000));

  await asUser(db, USER_A, async () => {
    await db.query(
      `insert into public.transactions (user_id, account_id, category_id, type, amount, note, occurred_at, economic_kind)
       values (auth.uid(), $1, $2, 'expense', 2500, 'гараар бичсэн хоол', '2026-01-20', 'normal')`,
      [accountId, food.id],
    );
  });

  const replay = await asUser(db, USER_A, () => db.query<{ result: Commit }>(
    `select public.commit_statement_import($1,'synthetic-khan.pdf',$2,'MNT',$3,$4,$5,$6,'****0019',false,$7::jsonb) as result`,
    [
      accountId, fileHash, parsed.periodStart, parsed.periodEnd,
      centsToDb(parsed.openingCents ?? 0), centsToDb(parsed.closingCents ?? 0), JSON.stringify(payload),
    ],
  ).then((res) => res.rows[0].result));
  assert.equal(replay.already_imported, true);
  assert.equal(replay.inserted, 0);

  const rolled = await asUser(db, USER_A, () => db.query<{ result: { deleted: number } }>(
    `select public.rollback_statement_import($1) as result`,
    [saved.import_id],
  ).then((res) => res.rows[0].result));
  assert.equal(rolled.deleted, saved.inserted);

  const left = await db.query<{ note: string }>(
    `select note from public.transactions where account_id = $1 order by note`,
    [accountId],
  );
  assert.deepEqual(left.rows.map((row) => row.note), ['гараар бичсэн хоол']);
  const hidden = await asUser(db, USER_B, async () => db.query(`select id from public.transactions`));
  assert.equal(hidden.rows.length, 0);
  await db.close();
});
