// Бодит Supabase дээр Auth + CRUD + RLS шалгах скрипт (node scripts/rls-test.mjs)
// Зөвхөн anon түлхүүр ашиглана. Тест хэрэглэгчдийг урьдчилан үүсгэсэн байх ёстой.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const URL = env.EXPO_PUBLIC_SUPABASE_URL, KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const A = { email: process.env.TEST_A_EMAIL, password: process.env.TEST_PASSWORD };
const B = { email: process.env.TEST_B_EMAIL, password: process.env.TEST_PASSWORD };
const ADMIN = { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_PASSWORD };

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };
const client = () => createClient(URL, KEY, { auth: { persistSession: false } });

// 0. Зочин (anon)
const anon = client();
const { data: anonCats } = await anon.from('categories').select('*');
ok('anon: үндсэн ангилал харна', anonCats?.length >= 13, `${anonCats?.length}`);
const { data: anonTx } = await anon.from('transactions').select('*');
ok('anon: гүйлгээ харагдахгүй', (anonTx ?? []).length === 0);
const { error: anonIns } = await anon.from('accounts').insert({ name: 'x', user_id: '00000000-0000-0000-0000-000000000000' });
ok('anon: insert хориотой', !!anonIns);

// 1. Нэвтрэх
const a = client(), b = client(), adm = client();
const la = await a.auth.signInWithPassword(A);
ok('A нэвтэрнэ', !la.error, la.error?.message);
const lb = await b.auth.signInWithPassword(B);
ok('B нэвтэрнэ', !lb.error, lb.error?.message);
const bad = await client().auth.signInWithPassword({ email: A.email, password: 'wrong-pass' });
ok('Буруу нууц үг татгалзана', !!bad.error);
const aId = la.data.user.id, bId = lb.data.user.id;

const { data: profA } = await a.from('profiles').select('*').eq('id', aId).single();
ok('A profile trigger-оор үүссэн', profA?.role === 'user');

// 2. CRUD (A)
const acc = await a.from('accounts').insert({ user_id: aId, name: 'Тест данс', type: 'cash', initial_balance: 100000 }).select().single();
ok('Create account', !acc.error, acc.error?.message);
const cat = (await a.from('categories').select('*').eq('type', 'expense').is('user_id', null).limit(1).single()).data;
const tx = await a.from('transactions').insert({ user_id: aId, account_id: acc.data.id, category_id: cat.id, type: 'expense', amount: 15000, note: 'rls-test хоол' }).select().single();
ok('Create transaction', !tx.error, tx.error?.message);
const tag = await a.from('tags').insert({ user_id: aId, name: 'rlstest' + Date.now() }).select().single();
ok('Create tag', !tag.error, tag.error?.message);
const tt = await a.from('transaction_tags').insert({ transaction_id: tx.data.id, tag_id: tag.data.id });
ok('Create transaction_tags (N:M)', !tt.error, tt.error?.message);
const joined = await a.from('transactions').select('*, category:categories(name), transaction_tags(tag:tags(name))').eq('id', tx.data.id).single();
ok('Read with joins', joined.data?.transaction_tags?.length === 1 && !!joined.data?.category?.name);
const bal = await a.from('account_balances').select('*').eq('id', acc.data.id).single();
ok('View balance = 100000-15000', Number(bal.data?.balance) === 85000, String(bal.data?.balance));
const upd = await a.from('transactions').update({ amount: 20000 }).eq('id', tx.data.id).select().single();
ok('Update transaction', Number(upd.data?.amount) === 20000);
const bud = await a.from('budgets').insert({ user_id: aId, category_id: cat.id, month: '2026-11-01', limit_amount: 300000 }).select().single();
ok('Create budget', !bud.error, bud.error?.message);
const dup = await a.from('budgets').insert({ user_id: aId, category_id: cat.id, month: '2026-11-01', limit_amount: 1 });
ok('Budget unique constraint (23505)', dup.error?.code === '23505');
const neg = await a.from('transactions').insert({ user_id: aId, account_id: acc.data.id, type: 'expense', amount: -5 });
ok('CHECK amount > 0', !!neg.error);
const ord = await a.from('premium_orders').insert({ user_id: aId, plan: 'monthly', amount: 9900 }).select().single();
ok('Create premium order (pending)', ord.data?.status === 'pending');
const paidSelf = await a.from('premium_orders').insert({ user_id: aId, plan: 'monthly', amount: 9900, status: 'paid' });
ok('Хэрэглэгч өөрөө paid захиалга үүсгэж чадахгүй', !!paidSelf.error);
const selfPaid = await a.from('premium_orders').update({ status: 'paid' }).eq('id', ord.data.id).select();
ok('Хэрэглэгч захиалгаа paid болгож чадахгүй', (selfPaid.data ?? []).length === 0);
await a.from('profiles').update({ role: 'admin' }).eq('id', aId);
const { data: profA2 } = await a.from('profiles').select('role').eq('id', aId).single();
ok('Хэрэглэгч өөрийгөө admin болгож чадахгүй', profA2.role === 'user');

// 3. RLS: B нь A-ийн өгөгдлийг харах/өөрчлөх боломжгүй
const bRead = await b.from('transactions').select('*').eq('id', tx.data.id);
ok('B нь A-ийн гүйлгээг харахгүй', (bRead.data ?? []).length === 0);
const bUpd = await b.from('transactions').update({ amount: 1 }).eq('id', tx.data.id).select();
ok('B нь A-ийн гүйлгээг засахгүй', (bUpd.data ?? []).length === 0);
const bDel = await b.from('accounts').delete().eq('id', acc.data.id).select();
ok('B нь A-ийн дансыг устгахгүй', (bDel.data ?? []).length === 0);
const bIns = await b.from('transactions').insert({ user_id: bId, account_id: acc.data.id, type: 'expense', amount: 1 });
ok('B нь A-ийн данс руу гүйлгээ нэмэхгүй', !!bIns.error);
const bFake = await b.from('accounts').insert({ user_id: aId, name: 'hack' });
ok('B нь A-ийн нэрээр мөр үүсгэхгүй', !!bFake.error);
const bProf = await b.from('profiles').select('*');
ok('B зөвхөн өөрийн profile харна', bProf.data?.length === 1 && bProf.data[0].id === bId);
const bTag = await b.from('transaction_tags').select('*');
ok('B нь A-ийн transaction_tags харахгүй', (bTag.data ?? []).every((r) => r.transaction_id !== tx.data.id));

// 4. Админ
const la2 = await adm.auth.signInWithPassword(ADMIN);
ok('Admin нэвтэрнэ', !la2.error, la2.error?.message);
const admProf = await adm.from('profiles').select('*');
ok('Admin бүх profile харна', (admProf.data ?? []).length >= 3, `${admProf.data?.length}`);
const admPaid = await adm.from('premium_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', ord.data.id).select();
ok('Admin захиалгыг paid болгоно', admPaid.data?.[0]?.status === 'paid');
const { data: profA3 } = await a.from('profiles').select('is_premium').eq('id', aId).single();
ok('Trigger: A premium болсон', profA3.is_premium === true);

// 5. Устгах (cascade)
const del = await a.from('transactions').delete().eq('id', tx.data.id).select();
ok('Delete transaction', del.data?.length === 1);
const ttLeft = await a.from('transaction_tags').select('*').eq('transaction_id', tx.data.id);
ok('transaction_tags cascade устсан', (ttLeft.data ?? []).length === 0);
await a.from('budgets').delete().eq('id', bud.data.id);
await a.from('tags').delete().eq('id', tag.data.id);
const delAcc = await a.from('accounts').delete().eq('id', acc.data.id).select();
ok('Delete account', delAcc.data?.length === 1);
await a.auth.signOut();
const after = await a.from('accounts').select('*');
ok('Гарсны дараа өгөгдөл харагдахгүй', (after.data ?? []).length === 0);

console.log(`\nНийт: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
