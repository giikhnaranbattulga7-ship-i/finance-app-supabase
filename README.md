# 💰 Хувийн санхүүгийн апп (Finance App · Supabase)

**SWM231 Мобайл програмчлал — Бие даалтын төсөл · Хамгаалалт-1**

🌐 **Web demo:** https://finance-app-supabase.vercel.app · demo: `demo.user@financeapp.test` / `Demo1234!`

React Native (Expo) + TypeScript + Expo Router + Supabase ашигласан, хувийн орлого, зарлага, данс, төсөв, шошгоо нэг дор хянах full-stack мобайл апп.

## 🎯 Шийдэх асуудал

Оюутан, залуучууд мөнгөө хаана зарцуулж байгаагаа мэддэггүй, сарын төгсгөлд мөнгө дутдаг. Банкны апп нь зөвхөн тухайн банкны гүйлгээг харуулдаг бөгөөд бэлэн мөнгө, олон данс, ангиллын төсвийг нэгтгэдэггүй. Энэ апп нь:

- бүх данс (бэлэн мөнгө, карт, хадгаламж)-ыг нэг дор нэгтгэнэ,
- гүйлгээг ангилал, шошгоор (N:M) бүртгэж, хайх/шүүх боломж олгоно,
- ангилал бүрт сарын төсөв тогтоож, хэтэрвэл анхааруулна,
- өгөгдлийг Supabase-д хадгалж, RLS-ээр хэрэглэгч бүрийн өгөгдлийг тусгаарлана.

## 👥 Хэрэглэгчийн төрлүүд

| Role | Эрх |
|---|---|
| **Зочин (guest)** | Бүртгэлгүйгээр апп-ын тухай болон үндсэн ангиллуудыг хайж, шүүж үзнэ (anon RLS) |
| **Хэрэглэгч (user)** | Данс, гүйлгээ, төсөв, ангилал, шошгоо CRUD хийнэ, Premium захиалга үүсгэнэ |
| **Админ (admin)** | Апп доторх админ самбараас хэрэглэгч, захиалга, орлогын статистикийг график/жагсаалтаар харж, захиалгын төлөв өөрчилнө |

## ✨ Боломжууд (Хамгаалалт-1)

- ✅ **Supabase Auth** — бүртгүүлэх, нэвтрэх, гарах, нууц үг сэргээх (имэйл линк + PKCE)
- ✅ **SecureStore** — session-ийг iOS Keychain / Android Keystore-д (хэсэглэж) хадгална
- ✅ **Хамгаалалттай навигаци** — `Stack.Protected` (guest / user / admin)
- ✅ **8 хүснэгт**, PK/FK, 1:N, N:M (`transaction_tags`), CHECK, UNIQUE
- ✅ **RLS бүх хүснэгтэд** + `is_admin()` SECURITY DEFINER функц
- ✅ **CRUD**: данс, гүйлгээ, төсөв, ангилал, шошго — validation + устгахын өмнө баталгаажуулалт
- ✅ **Хайлт, шүүлт, эрэмбэ** (тэмдэглэл, төрөл, ангилал, огноо/дүн), **infinite scroll**, **pull-to-refresh**
- ✅ **Dashboard** — нийт үлдэгдэл, сарын орлого/зарлага, ангиллын график
- ✅ **Админ самбар** — статистик, сараар бүртгэлийн график, захиалгын жагсаалт
- ✅ **UI төлөвүүд** — ачаалж буй, хоосон, алдаа, интернэт тасарсан (NetInfo)
- ✅ **Premium захиалга** (`premium_orders`, pending → paid trigger) — Хамгаалалт-2-т QPay/Stripe webhook холбогдоно
- ✅ **Хаан банкны хуулга** — PDF-ийг төхөөрөмж дээр уншиж, шалгаад, хэрэглэгч хадгалахыг дарсны дараа л оруулна. Давхардлыг сангийн түвшинд алгасна. Шилжүүлэг/хадгаламж/буцаалт зарлагаас тусдаа.

## 🧱 Технологи

| Хэсэг | Технологи |
|---|---|
| Frontend | React Native 0.88, Expo SDK 58, TypeScript, Expo Router (Stack + Tabs) |
| Backend | Supabase (Auth, PostgreSQL, RLS, View, Trigger) |
| Аюулгүй байдал | expo-secure-store, RLS, `.env` (зөвхөн anon key) |
| Бусад | @react-native-community/netinfo, @expo/vector-icons, fflate (локал PDF), expo-document-picker, expo-file-system |

## 🗂️ Кодын бүтэц

```
src/
├── app/                      # Expo Router — файл = дэлгэц
│   ├── _layout.tsx           # AuthProvider + Stack.Protected (guest/user/admin)
│   ├── index.tsx             # session-оос хамаарч redirect
│   ├── (auth)/               # login, register, forgot-password
│   ├── (tabs)/               # home, transactions, budgets, accounts, profile
│   ├── transaction/[id].tsx  # гүйлгээ нэмэх/засах/устгах (id = 'new' → нэмэх)
│   ├── account/[id].tsx      # данс форм
│   ├── budget/[id].tsx       # төсөв форм
│   ├── categories.tsx, tags.tsx, premium.tsx, admin.tsx, guest.tsx, reset-password.tsx
├── components/               # Button, Input, Card, Chip, Fab, StateViews, OfflineBanner, ...
├── context/AuthContext.tsx   # session, profile, role, signIn/signUp/signOut/reset
├── hooks/useAsync.ts         # useFocusData — focus бүрд өгөгдөл ачаална
├── lib/                      # supabase client, secureStorage, validation, theme, format
├── services/                 # Supabase query-ууд (accounts, transactions, budgets, tags, ...)
└── types/database.ts         # хүснэгтийн TypeScript төрлүүд
supabase/
├── schema.sql                # хүснэгт, view, функц, trigger, RLS policy
├── seed.sql                  # 13 үндсэн ангилал
└── demo-data.sql             # demo хэрэглэгчийн туршилтын өгөгдөл
scripts/rls-test.mjs          # бодит Supabase дээр Auth + CRUD + RLS тест (36 шалгалт)
docs/                         # ERD, user flow, дизайн, дэлгэцийн зургууд
```

## 🗄️ Өгөгдлийн сан (ERD)

Одоогийн бүтэц (шинэ `statement_imports` орсон): [`docs/diagrams/erd.mmd`](docs/diagrams/erd.mmd). Доорх зураг хамгаалалтын эхний хувилбар.

![ERD](docs/erd.png)

| Хүснэгт | Тайлбар | Холбоо |
|---|---|---|
| `profiles` | auth.users-ийн өргөтгөл, `role` (guest/user/admin), `is_premium` | auth.users 1:1 |
| `accounts` | Данс: бэлэн мөнгө, банк, карт, хадгаламж | profiles 1:N |
| `categories` | Ангилал (`user_id = null` → системийн үндсэн) | profiles 1:N |
| `transactions` | Орлого/зарлага, дүн > 0 | accounts 1:N, categories 1:N |
| `budgets` | Ангиллын сарын хязгаар, UNIQUE(user, category, month) | categories 1:N |
| `tags` | Хэрэглэгчийн шошго | profiles 1:N |
| `transaction_tags` | Гүйлгээ ↔ шошго, composite PK | **N:M** |
| `premium_orders` | Premium захиалга (pending/paid/cancelled) | profiles 1:N |
| `statement_imports` | Хуулгын багц (committed/rolled_back), файлын SHA-256 | profiles 1:N, accounts 1:N |
| `account_balances` (view) | Үлдэгдэл = эхний үлдэгдэл + орлого − зарлага, `security_invoker`. Шилжүүлэг ч үлдэгдэлд орно | — |

### RLS (Row Level Security)

- Бүх 9 хүснэгтэд `enable row level security`.
- Хэрэглэгч зөвхөн `user_id = auth.uid()` мөрөө харж/өөрчилнө.
- `transactions` insert/update хийхэд **данс нь өөрийнх эсэхийг** `exists(...)`-ээр шалгана.
- `transaction_tags` — гүйлгээ ба шошго хоёулаа өөрийнх байх ёстой.
- `categories` — үндсэн ангиллыг зочин (anon) ч уншина, зөвхөн өөрийнхөө ангиллыг засна.
- `premium_orders` — хэрэглэгч зөвхөн `pending` үүсгэнэ, төлөвийг зөвхөн админ/webhook өөрчилнө.
- `is_admin()` — `SECURITY DEFINER` тул profiles-ийн RLS-ийг тойрч уншина → policy дотор recursion үүсэхгүй.
- `statement_imports` — хэрэглэгч зөвхөн өөрийн багцаа харна. Төлөвийг шууд update хийхгүй, `rollback_statement_import` л `rolled_back` болгоно.
- `transactions.import_id` — гараар оруулсан мөрөнд null. Буцаахад зөвхөн тухайн багцын мөрүүд устана.
- `commit_statement_import` / `preview_statement_duplicates` / `rollback_statement_import` нь `security invoker`. `service_role` ашиглахгүй.
- `protect_profile_fields` trigger — хэрэглэгч өөрийгөө admin/premium болгож чадахгүй.

## 🔁 Хэрэглэгчийн урсгал

![User flow](docs/user-flow.png)

## 🎨 Дизайн (Figma mockup)

| | |
|---|---|
| ![](docs/design/00-design-system.png) | ![](docs/design/01-auth-flow.png) |
| ![](docs/design/02-core-screens.png) | ![](docs/design/03-manage-screens.png) |

![](docs/design/04-premium-admin.png)

## 📱 Дэлгэцийн зургууд

| Дэлгэц | Тайлбар |
|---|---|
| `01-login` | Нэвтрэх — имэйл/нууц үг validation, Монгол алдааны мессеж, «Зочноор үзэх» |
| `02-register` | Бүртгүүлэх — нэр, имэйл, нууц үг давталт шалгана |
| `03-guest` | Зочин — үндсэн ангиллыг хайх/шүүх (нэвтрэлтгүй, anon RLS) |
| `04-home` | Нүүр — нийт үлдэгдэл, сарын орлого/зарлага, ангиллын баган график, сүүлийн гүйлгээ |
| `05-transactions` | Гүйлгээ — хайлт (debounce), төрөл/ангилал шүүлт, эрэмбэ, infinite scroll, pull-to-refresh |
| `06-transaction-form` | Гүйлгээ нэмэх/засах — данс, ангилал, огноо, тэмдэглэл, олон шошго (N:M) |
| `07-budgets` | Төсөв — сар солих, зарцуулалтын явц, 80%+ шар, хэтэрвэл улаан |
| `08-accounts` | Данс — view-ээс тооцсон үлдэгдэл |
| `09-categories` | Ангилал — үндсэн нь 🔒, өөрийнх CRUD |
| `10-profile` | Профайл — role badge, нэр засах, цэс, гарах (баталгаажуулалт) |
| `11-premium` | Premium багц захиалах — pending төлөв |
| `12-admin` | Админ — хэрэглэгч/захиалга/гүйлгээний тоо, орлого, график |

Зургууд: [`docs/screenshots/`](docs/screenshots)

## 🚀 Суулгах, ажиллуулах

```bash
git clone https://github.com/giikhnaranbattulga7-ship-i/finance-app-supabase.git
cd finance-app-supabase
npm install
cp .env.example .env    # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY бөглөнө
npx expo start          # Expo Go апп-аар QR код уншуулна
```

### Supabase тохиргоо (шинэ төсөл дээр)

1. Supabase → SQL Editor дээр `supabase/schema.sql`, дараа нь `supabase/seed.sql`-ийг ажиллуулна.
2. (Сонголт) Demo хэрэглэгч бүртгүүлээд `supabase/demo-data.sql`-ийг ажиллуулна.
3. Админ болгох: `update profiles set role = 'admin' where id = (select id from auth.users where email = '...');`
4. Authentication → URL Configuration → Redirect URLs-д `financeapp://**` болон `exp://**` нэмнэ (нууц үг сэргээх линк).
5. Demo-д хурдан бүртгүүлэхийн тулд Authentication → Providers → Email → **Confirm email**-ийг унтрааж болно.

### Тест

```bash
npm run typecheck      # TypeScript
npm test               # синтетик PDF, ангилал, мөнгө, давхардал
npm run test:import-db # PGlite: RLS, atomic commit, rollback, давхардал
npm run build:web      # expo export -p web
TEST_A_EMAIL=... TEST_B_EMAIL=... TEST_ADMIN_EMAIL=... TEST_PASSWORD=... npm run test:rls
```

Бодит хуулгыг репод бүү оруул. Локал шалгалт (зөвхөн тоо, нэр/дүн хэвлэхгүй):

```bash
node --import tsx scripts/validate-private-statement.ts /path/outside-the-repo/statement.pdf
```

## 🔐 Аюулгүй байдал

- `.env` нь `.gitignore`-д орсон; апп-д **зөвхөн anon (нийтийн) түлхүүр** `EXPO_PUBLIC_` хувьсагчаар орно.
- `service_role` түлхүүр апп-ын кодонд **хэзээ ч байхгүй** — апп-ыг задалж уншиж болох тул.
- Хамгаалалт нь клиент дээр биш, **өгөгдлийн сангийн RLS** дээр хийгдэнэ.

## Хуулга оруулах

Дэмжинэ: **Хаан банкны текст PDF** (олон хуудас, мөр дамжсан утга, орлого/зарлага, 2 орны дүн). Файл 8 МБ, 25 хуудас, 2500 мөрөөс хэтрэхгүй.

Дэмжихгүй: нууц үгтэй PDF, сканнер/зураг, Excel, бусад банк. Бүх PDF-ийг уншина гэж үзэхгүй.

Урсгал: файл сонгох → төхөөрөмж дээр задлах → мөр бүрийг засах/хасах → **Хадгалах** дарсны дараа л Supabase. Давхардсан мөрийг `fingerprint` + `occ` unique index алгасна. Ижил цаг, ижил дүн, өөр үлдэгдэлтэй хоёр худалдан авалт хоёулаа үлдэнэ. Эхний үлдэгдлийг данс хоосон, одоогийн үлдэгдэл 0 үед л тавина.

Тайлбар: [`docs/huulga-tailbar.md`](docs/huulga-tailbar.md). Дизайн: [`docs/statement-import-design.md`](docs/statement-import-design.md).

### Production руу гаргахын өмнө (одоогоор хийгээгүй)

1. Supabase SQL Editor дээр `supabase/migrations/20261107_statement_import.sql`-ийг нэг удаа ажиллуулна. Хүснэгт устгахгүй, багана нэмнэ.
2. `service_role` түлхүүрийг клиентэд бүү тавь. Энэ өөрчлөлт Edge Function шаардахгүй.
3. Дараа нь web deploy. Миграци хийхээс өмнө deploy хийвэл хуулга болон тайлан `economic_kind` баганаас болж алдаа заана.
4. Бодит хуулга, түүний текст, нэр, данс, дүн, screenshot-ыг git-д бүү оруул.

## 🗺️ Хамгаалалт-2 төлөвлөгөө

- QPay sandbox нэхэмжлэх (Supabase Edge Function) + webhook → `premium_orders.status = 'paid'`
- Expo Push Notification (захиалгын төлөв өөрчлөгдөхөд)
- Баримтын зураг: камер/цомог → шахах → Supabase Storage
- EAS Build → APK / бодит утсанд суулгах
