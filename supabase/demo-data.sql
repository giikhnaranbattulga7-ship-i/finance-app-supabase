-- Demo-д зориулсан туршилтын өгөгдөл (demo.user@financeapp.test хэрэглэгчид)
do $$
declare
  uid uuid := (select id from auth.users where email = 'demo.user@financeapp.test');
  cash uuid; card uuid;
  c_food uuid := (select id from categories where user_id is null and name = 'Хоол хүнс');
  c_bus uuid := (select id from categories where user_id is null and name = 'Тээвэр');
  c_rent uuid := (select id from categories where user_id is null and name = 'Түрээс');
  c_fun uuid := (select id from categories where user_id is null and name = 'Зугаа цэнгэл');
  c_sal uuid := (select id from categories where user_id is null and name = 'Цалин');
  c_sch uuid := (select id from categories where user_id is null and name = 'Тэтгэлэг');
  t_uni uuid; t_fr uuid; tx uuid;
begin
  if uid is null then return; end if;
  delete from accounts where user_id = uid;
  delete from tags where user_id = uid;
  delete from budgets where user_id = uid;
  insert into accounts (user_id, name, type, initial_balance) values (uid, 'Бэлэн мөнгө', 'cash', 50000) returning id into cash;
  insert into accounts (user_id, name, type, initial_balance) values (uid, 'Хаан банк карт', 'card', 400000) returning id into card;
  insert into tags (user_id, name) values (uid, 'сургууль') returning id into t_uni;
  insert into tags (user_id, name) values (uid, 'найзууд') returning id into t_fr;
  insert into transactions (user_id, account_id, category_id, type, amount, note, occurred_at) values
    (uid, card, c_sal, 'income', 1200000, 'Цагийн ажлын цалин', date_trunc('month', current_date)::date),
    (uid, card, c_sch, 'income', 300000, 'Сургалтын тэтгэлэг', date_trunc('month', current_date)::date + 2),
    (uid, card, c_rent, 'expense', 450000, 'Байрны түрээс', date_trunc('month', current_date)::date + 1),
    (uid, cash, c_bus, 'expense', 25000, 'Автобусны карт цэнэглэсэн', current_date - 3),
    (uid, card, c_food, 'expense', 85000, 'Сарын хүнс', current_date - 2),
    (uid, cash, c_food, 'expense', 12000, 'Өдрийн хоол', current_date - 1);
  insert into transactions (user_id, account_id, category_id, type, amount, note, occurred_at)
    values (uid, cash, c_fun, 'expense', 40000, 'Кино, кафе', current_date) returning id into tx;
  insert into transaction_tags values (tx, t_fr);
  insert into transactions (user_id, account_id, category_id, type, amount, note, occurred_at)
    values (uid, card, c_food, 'expense', 9000, 'Хичээлийн завсар кофе', current_date) returning id into tx;
  insert into transaction_tags values (tx, t_uni);
  insert into budgets (user_id, category_id, month, limit_amount) values
    (uid, c_food, date_trunc('month', current_date)::date, 150000),
    (uid, c_fun, date_trunc('month', current_date)::date, 30000),
    (uid, c_bus, date_trunc('month', current_date)::date, 60000);
end $$;
