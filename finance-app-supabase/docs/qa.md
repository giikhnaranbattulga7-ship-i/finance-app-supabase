# Хамгаалалт-1 — Багшийн асуулт ба хариулт (30)

## A. Ерөнхий, архитектур
**1. Яагаад Expo/React Native сонгосон бэ?** Нэг TypeScript кодоор Android, iOS, web гарна. Expo Go-оор native build хийлгүй утсан дээр шууд туршина. Expo Router нь файл дээр суурилсан навигаци өгдөг.

**2. Кодын давхаргууд юу вэ?** Дэлгэц (`src/app`) нь `src/services/*.ts`-ийг дууддаг. Services нь `src/lib/supabase.ts` client-ээр Supabase руу хандана. Auth төлөв `src/context/AuthContext.tsx`-д, дахин ашиглагдах UI `src/components`-д байна.

**3. Expo Router-д файл бүтэц хэрхэн route болдог вэ?** `(auth)`, `(tabs)` бол group, URL-д орохгүй. `transaction/[id].tsx` бол dynamic route. `id=new` бол нэмэх, бусад үед засах горимд ажиллана. `_layout.tsx` нь Stack/Tabs-ыг тодорхойлно.

**4. Нэвтрээгүй хүнийг дотор дэлгэцээс яаж хамгаалдаг вэ?** `src/app/_layout.tsx`-д `Stack.Protected guard={!!session}` ашигладаг. Админ дэлгэц нэмэлтээр `guard={isAdmin}`-ээр хамгаалагдана. Гэхдээ жинхэнэ хамгаалалт нь серверийн RLS дээр.

**5. Offline үед юу болох вэ?** `OfflineBanner.tsx` нь NetInfo-оор сүлжээг хянаж анхааруулга харуулна. Хүсэлт амжилтгүй болбол `StateViews`-ийн алдааны төлөв «Дахин оролдох» товчтой гарна.

## B. Auth ба SecureStore
**6. Session хаана хадгалагдах вэ, яагаад?** `expo-secure-store`-д (iOS Keychain, Android Keystore) хадгална. AsyncStorage шифрлэгддэггүй тул токен хадгалахад аюултай.

**7. `secureStorage.ts` яагаад chunk хийдэг вэ?** SecureStore нэг утгад ~2048 байтын хязгаартай, харин Supabase session JSON (access + refresh JWT) үүнээс том. Тиймээс 1800 тэмдэгтээр хувааж `key.0, key.1…` болгон хадгалж, тоог нь `key.chunks`-д бичнэ. Web дээр localStorage руу шилждэг.

**8. Бүртгүүлэхэд profiles мөр яаж үүсдэг вэ?** `auth.users`-д insert болоход `on_auth_user_created` trigger `handle_new_user()`-г дуудна. Энэ функц `raw_user_meta_data`-с full_name авч profile-ыг role='user'-ээр үүсгэнэ.

**9. Нууц үг сэргээх урсгал?** `resetPasswordForEmail(email, {redirectTo: financeapp://reset-password})` илгээгдэнэ. Линк апп-ыг `?code=` параметртэй нээнэ. `exchangeCodeForSession(code)` (PKCE) дуудсаны дараа `updateUser({password})` хийнэ.

**10. PKCE гэж юу вэ?** Апп санамсаргүй code_verifier үүсгээд hash-ийг нь серверт илгээдэг. Линкээр ирсэн code-ыг session болгоход verifier шаардлагатай. Тиймээс линкийг барьж авсан гуравдагч этгээд session авч чадахгүй.

**11. Гарахад юу болдог вэ?** Баталгаажуулах цонх гарна. Дараа нь `supabase.auth.signOut()` refresh токеныг хүчингүй болгож, SecureStore-оос устгана. `onAuthStateChange` session=null болгосноор guard login руу шилжүүлнэ.

**12. Токен хугацаа дуусвал?** `autoRefreshToken: true`. `AppState` идэвхтэй болоход `startAutoRefresh()`, background-д `stopAutoRefresh()` дуудна.

## C. Өгөгдлийн сан
**13. Хүснэгтүүд ба холбоо?** 8 хүснэгт: profiles, accounts, categories, transactions, budgets, tags, transaction_tags, premium_orders. profiles–auth.users нь 1:1. Хэрэглэгч→accounts/transactions/budgets/tags нь 1:N. transactions↔tags нь N:M.

**14. N:M-ийг яаж хийсэн бэ?** `transaction_tags(transaction_id, tag_id)` нь composite PK-тэй. Хоёр FK `on delete cascade`, тиймээс гүйлгээ устахад холбоос нь устна.

**15. Үндсэн ангилал ба хэрэглэгчийн ангиллыг яаж ялгах вэ?** `categories.user_id IS NULL` бол seed-ээр орсон үндсэн ангилал. Үүнийг бүгд харна, гэхдээ зөвхөн админ засна. user_id-тай бол хувийн ангилал.

**16. Ямар constraint байгаа вэ?** `CHECK (amount > 0)` болон `type in ('income','expense')`. `UNIQUE(user_id, category_id, month)` нь давхар төсөв үүсэхээс сэргийлнэ. Мөн NOT NULL, FK-нүүд бий.

**17. Үлдэгдлийг яаж тооцдог вэ?** `account_balances` view: initial_balance + орлого − зарлага. Энэ нь `security_invoker = true` тохиргоотой тул view дуудсан хэрэглэгчийн RLS үйлчилнэ, бусдын данс харагдахгүй.

**18. Данс устгавал гүйлгээ нь?** transactions.account_id нь `on delete cascade`. Тиймээс апп «бүх гүйлгээ устана» гэж баталгаажуулалт асуудаг.

## D. RLS ба аюулгүй байдал
**19. RLS гэж юу, яагаад заавал хэрэгтэй вэ?** Postgres-ийн мөрийн түвшний хамгаалалт. Anon key апп дотор нээлттэй байдаг тул хэн ч API-г шууд дуудаж чадна. RLS байхгүй бол бусдын өгөгдлийг уншиж болно.

**20. `using` ба `with check` ялгаа?** `using` нь аль мөрийг харах, засах, устгахыг шүүнэ. `with check` нь insert/update хийгдэх шинэ мөр нөхцөл хангаж байгааг шалгана.

**21. Хэрэглэгч бусдын дансанд гүйлгээ нэмэх гэвэл?** transactions-ийн insert policy `user_id = auth.uid()`-ээс гадна `exists(select 1 from accounts where id = account_id and user_id = auth.uid())`-ийг шалгана. Тиймээс татгалзана. Энэ нь RLS тестэд багтсан.

**22. `is_admin()` яагаад SECURITY DEFINER вэ?** profiles-ийн policy дотроос profiles-ийг уншвал policy өөрийгөө дахин дуудаж infinite recursion болно. Definer функц RLS-ийг тойрч зөвхөн role-ыг уншина. `search_path` тогтоосон.

**23. Хэрэглэгч өөрийгөө admin болгож чадах уу?** Үгүй. `protect_profile_fields` BEFORE UPDATE trigger нь `auth.uid() is not null and not is_admin()` үед role болон is_premium-ийн өөрчлөлтийг хуучин утгаар нь сэргээнэ.

**24. service_role key хаана байдаг вэ?** Апп-д огт байхгүй. `.env`-д зөвхөн `EXPO_PUBLIC_SUPABASE_URL` ба `EXPO_PUBLIC_SUPABASE_ANON_KEY` байна. `.env` нь `.gitignore`-д орсон. EXPO_PUBLIC_ хувьсагч bundle-д ордог тул нууц зүйл тэнд тавихгүй.

**25. RLS-ийг яаж туршсан бэ?** `scripts/rls-test.mjs` (`npm run test:rls`) нь бодит Supabase дээр 3 хэрэглэгчээр (user, other, admin) нэвтэрнэ. Бусдын өгөгдөл унших, засах, устгах, өөрийгөө админ болгох, буруу FK зэргийг шалгадаг. 36/36 тест амжилттай.

## E. Код ба UI
**26. Validation хаана хийгддэг вэ?** Клиентэд `src/lib/validation.ts` (имэйл формат, нууц үг ≥8, дүн > 0) ажиллаж, алдааг талбар бүрийн доор Монголоор харуулна. Сервер талд CHECK/UNIQUE давхар хамгаална. UNIQUE зөрчлийн алдааг `services/helpers.ts` ойлгомжтой мессеж болгоно.

**27. Loading/empty/error төлөвийг яаж зохицуулсан бэ?** `hooks/useAsync.ts` нь data, loading, error, reload буцаана. `StateViews.tsx` нь Loading, Empty, Error компонент өгнө. Мөн жагсаалтууд pull-to-refresh-тэй.

**28. Хайлт, шүүлт, эрэмбэ?** `services/transactions.ts` нь `ilike('note', %q%)`, `eq('type')`, `eq('account_id')`, `order(date|amount)` ашиглана. Шүүлт сервер дээр хийгддэг тул их өгөгдөлд ч хурдан.

**29. Устгахын өмнөх баталгаажуулалт?** `lib/confirm.ts` нь native дээр `Alert.alert`, web дээр `window.confirm` ашигладаг. Promise<boolean> буцаадаг тул `if (await confirm(...))` гэж бичнэ.

**30. Хамгаалалт-2-т юу нэмэх вэ?** QPay sandbox-ийг Edge Function-ээр холбоно (service key зөвхөн серверт байна). Webhook нь `premium_orders.status='paid'` болгоход `on_order_paid` trigger `is_premium`-ийг асаана. Үүнээс гадна Expo push, баримтын зураг (Storage), EAS Build нэмнэ.
