# Хамгаалалт-1 шалгалтын хуудас

Эх сурвалж: багшийн 6 хуудас удирдамж, «08 Хамгаалалт-1 · 15 оноо». Хамгаалалт-2 (камер, QPay/Stripe webhook, push, EAS, бодит утас) энэ жагсаалтад ороогүй. Төлөв нь 2026-11-07-ны кодоор.

Тэмдэг: **баталгаажсан** = энэ репо дээр командаар эсвэл файлаар шалгасан. **дутуу** = байхгүй, эсвэл энэ орчинд ажиллуулаагүй.

## Онооны мөр

| Үзүүлэлт | Оноо | Төлөв | Нотолгоо |
|---|---|---|---|
| Шаардлага ба дизайн | 2 | хэсэгчлэн | Асуудал, урсгал README болон `docs/statement-import-design.md`. ERD-ийн эх нь `docs/diagrams/erd.mmd`, зураг нь `docs/erd.png` (9 хүснэгт, `statement_imports` орсон, 1:N болон N:M). **Figma холбоос байхгүй** (`figma.com` хайлт хоосон). |
| React Native ба кодын бүтэц | 2 | баталгаажсан (код) | `src/app` дэлгэц, `src/services` өгөгдөл, `src/lib` тооцоо. Expo Router tab + `Stack.Protected`. `npx tsc --noEmit` амжилттай. |
| Supabase backend | 3 | баталгаажсан (локал SQL) / production дутуу | RLS, Auth trigger, `security invoker` функц. `npm run test:import-db` 2/2. Production дээр миграци хийгээгүй. |
| Ажиллагаа (Expo Go / эмулятор) | 2 | дутуу | Вэб export амжилттай. **Expo Go болон эмулятор энэ орчинд асаагаагүй.** Бодит утсан дээр CRUD-ийг «ажилласан» гэж хэлэхгүй. |
| UI/UX | 2 | хэсэгчлэн | Нүүр, Гүйлгээ, Бусад. Ачаалж буй, хоосон, алдаа, интернет тасарсан төлөв код дээр бий. Өргөн ба 390px screenshot нь синтетик хуулгаар. Бодит утасны хэмжээг гараар батлаагүй. |
| Илтгэл ба цаг | 1 | дутуу | PPT файлыг энэ ажилд хийгээгүй. 5+3+2 минут бол дараагийн багц. |
| Кодын асуулт | 3 | бэлтгэсэн | `docs/huulga-tailbar.md` дотор 3 мөрийн асуулт. Багш өөр мөр сонгож болно. |

## Заавал байх боломж (Хамгаалалт-1-д хамаарах хэсэг)

| Шаардлага | Төлөв | Хаана |
|---|---|---|
| Бүртгүүлэх, нэвтрэх, гарах, нууц үг сэргээх | код бэлэн, энэ орчинд амьд Supabase-аар дахин нэвтрээгүй | `src/app/(auth)`, `src/context/AuthContext.tsx` |
| SecureStore (утсан дээр), web дээр localStorage | код бэлэн | `src/lib/secureStorage.ts` |
| Зочин / хэрэглэгч / админ | код бэлэн | `src/app/_layout.tsx` 18–36-р мөр, `Stack.Protected` |
| Хамгийн багадаа 6 хүснэгт, PK/FK, 1:N, N:M | баталгаажсан | 9 хүснэгт. N:M нь `transaction_tags`. 1:N олон. |
| ERD | хэсэгчлэн | `docs/diagrams/erd.mmd` болон `docs/erd.png` дээр `statement_imports` байна. Figma ERD байхгүй. |
| CRUD, validation, устгахын өмнө асуух | код бэлэн | Гүйлгээ, данс, төсөв, ангилал, шошго. `confirmAction`. |
| Хайлт, шүүлт, эрэмбэ, infinite scroll, pull-to-refresh | код бэлэн | `src/app/(tabs)/transactions.tsx` |
| Админ самбар | код бэлэн, Бусад цэсэнд | `src/app/admin.tsx` |
| Хоосон, ачаалах, алдаа, интернет тасарсан | код бэлэн | `StateViews`, `OfflineBanner` |
| RLS, service_role клиентэд байхгүй | баталгаажсан | `.env.example` зөвхөн anon. Миграци `security invoker`. |
| Камер, төлбөрийн webhook, push, EAS | зориуд хийгээгүй | Хамгаалалт-2 |

## Хуулгын нэмэлт шалгалт

| Алхам | Төлөв |
|---|---|
| Синтетик PDF унших | `npm test` 8/8 |
| Данс үүсгэх → засах → хадгалах → тайлан → дахин оруулах → багцаар буцаах, гараар бичсэн мөр үлдэх, шилжүүлэг зарлагад орохгүй | `npm run test:import-db` 2-р тест, PGlite. Орлого `800000.00`, жинхэнэ зарлагад шилжүүлгийн `200000.00` ороогүй. |
| Нэвтэрсэн вэб дээр хадгалах товч жинхэнэ Supabase руу | дутуу. Энэ орчинд төсөл байхгүй. Худлаа session-оор review дэлгэц нээгдэнэ, дансны жагсаалт хоосон тул хадгалах идэвхгүй. |

## Миграцийн аюулгүй байдал

Файл: `supabase/migrations/20261107_statement_import.sql`.

- `DROP TABLE`, `TRUNCATE`, хуучин гүйлгээг `update` хийх команд байхгүй. `economic_kind` нь баганын default.
- Одоо байгаа `transactions owner all` policy-г устгахгүй. Шинэ policy нь `restrictive`.
- Production preflight: `transactions_note_check` нь `char_length(note) <= 200`. Миграци энэ check-г устгахгүй, 500 болгож суллахгүй. Урт утгыг чимээгүй таслахгүй.
- Шинэ хүснэгт `create table if not exists`. Багана `add column if not exists`.
- `delete from transactions` зөвхөн `rollback_statement_import` дотор, `import_id` болон `user_id = auth.uid()` шүүлттэй. Гараар оруулсан мөр (`import_id` null) устахгүй.
- `commit_statement_import`, `preview_statement_duplicates`, `rollback_statement_import` нь `security invoker`. `auth.uid()`-аар эзнээ авна. Клиент `user_id` явуулж эрх ахиулахгүй.
- `statement_fingerprint` / `sha256_hex` нь тооцооны функц, өөр хүний мөр уншихгүй.
- Anon дээр commit/rollback эрх өгөөгүй.
- Production дээр энэ файлыг ажиллуулаагүй. Deploy хийгээгүй.
