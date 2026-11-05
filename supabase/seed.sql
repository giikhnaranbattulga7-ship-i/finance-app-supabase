-- Системийн үндсэн ангиллууд (user_id = null → бүх хэрэглэгчид харагдана)
insert into public.categories (user_id, name, type, icon, color) values
  (null, 'Хоол хүнс',   'expense', 'fast-food',   '#F97316'),
  (null, 'Тээвэр',      'expense', 'bus',         '#0EA5E9'),
  (null, 'Түрээс',      'expense', 'home',        '#8B5CF6'),
  (null, 'Төлбөр',      'expense', 'receipt',     '#EF4444'),
  (null, 'Зугаа цэнгэл','expense', 'game-controller','#EC4899'),
  (null, 'Эрүүл мэнд',  'expense', 'medkit',      '#10B981'),
  (null, 'Боловсрол',   'expense', 'school',      '#6366F1'),
  (null, 'Хувцас',      'expense', 'shirt',       '#F59E0B'),
  (null, 'Бусад зарлага','expense','ellipsis-horizontal','#6B7280'),
  (null, 'Цалин',       'income',  'cash',        '#16A34A'),
  (null, 'Тэтгэлэг',    'income',  'ribbon',      '#22C55E'),
  (null, 'Бэлэг',       'income',  'gift',        '#84CC16'),
  (null, 'Бусад орлого','income',  'add-circle',  '#14B8A6')
on conflict do nothing;
