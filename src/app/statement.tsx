import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { ErrorView, LoadingView } from '../components/StateViews';
import { formatDate } from '../lib/format';
import { centsToDb, formatCents, numberToCents, parseUserMoney } from '../lib/money';
import { classifyNote, EconomicKind, kindLabel } from '../lib/statements/classify';
import { buildCommitRows } from '../lib/statements/commitRows';
import { StatementFileError, statementErrorText } from '../lib/statements/errors';
import { isStoredDuplicate } from '../lib/statements/fingerprint';
import { STATEMENT_LIMITS } from '../lib/statements/limits';
import { planOpening } from '../lib/statements/opening';
import { parseStatementFile } from '../lib/statements/parseStatement';
import { withBalanceIssues } from '../lib/statements/khanBank';
import { DraftRow, ParsedStatement } from '../lib/statements/types';
import { colors } from '../lib/theme';
import { listAccounts } from '../services/accounts';
import { listCategories } from '../services/categories';
import { commitStatementImport, countAccountTransactions, hashPdf, ImportCommitResult, previewDuplicates } from '../services/imports';
import { AccountBalance, Category } from '../types/database';

const KINDS: EconomicKind[] = ['normal', 'transfer', 'savings', 'refund', 'unclassified'];

async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (asset.size && asset.size > STATEMENT_LIMITS.maxBytes) throw new StatementFileError('too_large');
  const name = asset.name?.toLowerCase() ?? '';
  const mime = asset.mimeType ?? '';
  if (name && !name.endsWith('.pdf') && mime && mime !== 'application/pdf') throw new StatementFileError('unsupported');
  if (asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  const file = new ExpoFile(asset.uri);
  return new Uint8Array(await file.arrayBuffer());
}

export default function StatementScreen() {
  const net = useNetInfo();
  const offline = net.isConnected === false;
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<'pick' | 'parsing' | 'review' | 'saving' | 'done' | 'error'>('pick');
  const [progress, setProgress] = useState('Файл уншиж байна...');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('statement.pdf');
  const [fileHash, setFileHash] = useState('');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [txCount, setTxCount] = useState(0);
  const [applyOpening, setApplyOpening] = useState(false);
  const [dupIds, setDupIds] = useState<Set<string>>(new Set());
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);

  useEffect(() => {
    listAccounts().then((list) => {
      setAccounts(list);
      setAccountId((current) => current ?? list[0]?.id ?? null);
    }).catch(() => {});
    listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!accountId) return;
    countAccountTransactions(accountId).then(setTxCount).catch(() => setTxCount(0));
  }, [accountId]);

  const account = accounts.find((item) => item.id === accountId) ?? null;
  const openingPlan = parsed && account ? planOpening({
    initialCents: numberToCents(account.initial_balance),
    transactionCount: txCount,
    statementOpeningCents: parsed.openingCents ?? 0,
    userWantsApply: applyOpening,
  }) : null;

  useEffect(() => {
    if (!parsed || !account) return;
    const locked = planOpening({
      initialCents: numberToCents(account.initial_balance),
      transactionCount: txCount,
      statementOpeningCents: parsed.openingCents ?? 0,
      userWantsApply: true,
    });
    setApplyOpening(locked.action === 'set');
  }, [accountId, parsed, txCount, account]);

  const blocking = rows.some((row) => !row.excluded && row.issues.length > 0);

  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;
    for (const row of rows) {
      if (row.excluded || row.amountCents == null) continue;
      if (row.amountCents > 0) credit += row.amountCents;
      else debit += Math.abs(row.amountCents);
    }
    return { credit, debit, kept: rows.filter((row) => !row.excluded).length };
  }, [rows]);

  const parseBytes = async (data: Uint8Array, name: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('parsing');
    setErrorText(null);
    setProgress('PDF-ээс текст гаргаж байна...');
    try {
      const next = await parseStatementFile(data, {
        signal: controller.signal,
        onPage: (done, total) => setProgress(`Хуудас ${done}/${total} уншиж байна...`),
      });
      if (controller.signal.aborted) return;
      setParsed(next);
      setRows(next.rows);
      setFileHash(hashPdf(data));
      setFileName(name.replace(/[\\/]/g, '').slice(0, 180) || 'statement.pdf');
      setBytes(data);
      setPhase('review');
    } catch (error) {
      if (controller.signal.aborted) {
        setPhase(bytes ? 'review' : 'pick');
        return;
      }
      setErrorText(error instanceof StatementFileError ? statementErrorText(error.code) : (error as Error).message);
      setBytes(data);
      setFileName(name);
      setPhase('error');
    }
  };

  const pick = async () => {
    if (offline) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      base64: false,
      multiple: false,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    try {
      const data = await readPickedFile(asset);
      await parseBytes(data, asset.name || 'statement.pdf');
    } catch (error) {
      setErrorText(error instanceof StatementFileError ? statementErrorText(error.code) : (error as Error).message);
      setPhase('error');
    }
  };

  useEffect(() => {
    if (phase !== 'review' || !accountId || !parsed || offline) return;
    let cancel = false;
    const timer = setTimeout(() => {
    const payload = buildCommitRows(rows, categories);
    previewDuplicates(accountId, payload).then((counts) => {
      if (cancel) return;
      const ids = new Set<string>();
      payload.forEach((row, index) => {
        if (!row.exclude && isStoredDuplicate(row.occ, counts[index] ?? 0)) ids.add(rows[index].id);
      });
      setDupIds(ids);
      setPreviewNote(ids.size ? `${ids.size} мөр өмнө нь бүртгэгдсэн тул хадгалах үед алгасна.` : null);
    }).catch((error: Error) => {
      if (!cancel) setPreviewNote(error.message);
    });
    }, 400);
    return () => { cancel = true; clearTimeout(timer); };
  }, [phase, accountId, parsed, rows, categories, offline]);

  const patchRow = (id: string, patch: Partial<DraftRow>, reclass = false) => {
    setRows((current) => {
      const next = current.map((row) => {
        if (row.id !== id) return row;
        const merged = { ...row, ...patch };
        if (reclass && merged.amountCents != null && merged.amountCents !== 0) {
          const result = classifyNote(merged.note, merged.amountCents > 0 ? 'in' : 'out');
          merged.kind = result.kind;
          merged.categoryName = result.categoryName;
          merged.confidence = result.confidence;
          merged.reason = result.reason;
        }
        return merged;
      });
      return withBalanceIssues(next);
    });
  };

  const save = async () => {
    if (!parsed || !accountId || blocking || offline) return;
    setPhase('saving');
    try {
      const saved = await commitStatementImport({
        accountId,
        fileName,
        fileSha256: fileHash,
        currency: parsed.currency || 'MNT',
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        opening: parsed.openingCents == null ? null : centsToDb(parsed.openingCents),
        closing: parsed.closingCents == null ? null : centsToDb(parsed.closingCents),
        maskedAccount: parsed.maskedAccount,
        applyOpening: openingPlan?.action === 'set' && applyOpening,
        rows: buildCommitRows(rows, categories),
      });
      setResult(saved);
      setPhase('done');
    } catch (error) {
      setErrorText((error as Error).message);
      setPhase('review');
    }
  };

  const summary = parsed ? (
    <Card>
      <Text style={styles.section} accessibilityRole="header">Шалгалт</Text>
      <Text style={styles.line}>Хугацаа: {parsed.periodStart ? formatDate(parsed.periodStart) : '—'} – {parsed.periodEnd ? formatDate(parsed.periodEnd) : '—'}</Text>
      <Text style={styles.line}>Валют: {parsed.currency} · Данс: {parsed.maskedAccount ?? 'тодорхойгүй'}</Text>
      <Text style={styles.line}>Эхний үлдэгдэл {parsed.openingCents == null ? '—' : formatCents(parsed.openingCents)}</Text>
      <Text style={styles.line}>Эцсийн үлдэгдэл {parsed.closingCents == null ? '—' : formatCents(parsed.closingCents)}</Text>
      <Text style={styles.line}>Дансанд орсон {formatCents(totals.credit)} · Данснаас гарсан {formatCents(totals.debit)} · {totals.kept} мөр хадгална</Text>
      <Text style={styles.line}>{parsed.chainOk ? 'Үлдэгдэл мөр бүрээр таарсан.' : 'Зарим мөрийн үлдэгдэл зөрүүтэй. Засах эсвэл хасна уу.'}</Text>
      <Text style={styles.line}>{parsed.totalsOk == null ? 'Нийт дүнгийн мөр олдсонгүй.' : parsed.totalsOk ? 'Нийт дүн таарсан.' : 'Нийт дүн зөрүүтэй.'}</Text>
      {parsed.warnings.map((warning) => <Text key={warning} style={styles.warn}>{warning}</Text>)}
      {previewNote ? <Text style={styles.warn}>{previewNote}</Text> : null}
      {errorText && phase === 'review' ? <Text style={styles.warn}>{errorText}</Text> : null}
      <Text style={styles.hint}>Дансанд орсон, гарсан мөнгө үлдэгдлийг өөрчилнө. Жинхэнэ орлого, зарлагад зөвхөн «Тайланд орно» гэсэн мөр орно. Ангилаагүй мөрийг дарж засна.</Text>
    </Card>
  ) : null;

  return (
    <Screen title="Хуулга оруулах">
      <Stack.Screen options={{ headerShown: false }} />
      {phase === 'pick' ? (
        <ScrollView contentContainerStyle={styles.page}>
          <Card>
            <Text style={styles.section} accessibilityRole="header">Хаан банкны текст PDF</Text>
            <Text style={styles.hint}>Файл энэ төхөөрөмж дээр уншигдана. Гадаад AI эсвэл гуравдагч сервер рүү илгээхгүй. Хадгалахыг тусад нь дарна.</Text>
            <Text style={styles.hint}>Дэмжинэ: Хаан банкны дансны хуулга (текст сонгогддог PDF), олон хуудас, мөр дамжсан утга, орлого/зарлага, 2 орны дүн.</Text>
            <Text style={styles.hint}>Дэмжихгүй: нууц үгтэй PDF, сканнер/зураг, Excel, бусад банк. Бүх PDF-ийг ойлгоно гэж үзэхгүй.</Text>
            <Text style={styles.hint}>Хязгаар: 8 МБ, 25 хуудас, 2500 мөр. Утга 200 тэмдэгтээс урт бол хадгалахын өмнө богиносгоно. Интернетгүй үед хадгалахгүй.</Text>
            <Button title={offline ? 'Интернэтгүй байна' : 'PDF сонгох'} onPress={pick} disabled={offline} />
            <Button title="Оруулсан хуулгууд" variant="outline" onPress={() => router.push('/statement-history')} style={{ marginTop: 10 }} />
          </Card>
        </ScrollView>
      ) : null}

      {phase === 'parsing' ? (
        <View style={styles.center}>
          <LoadingView text={progress} />
          <Button title="Болих" variant="outline" onPress={() => abortRef.current?.abort()} />
        </View>
      ) : null}

      {phase === 'error' ? (
        <View style={styles.page}>
          <ErrorView message={errorText ?? 'Алдаа'} onRetry={() => (bytes ? parseBytes(bytes, fileName) : pick())} />
          <Button title="Өөр файл" variant="outline" onPress={pick} />
        </View>
      ) : null}

      {phase === 'review' || phase === 'saving' ? (
        <ScrollView contentContainerStyle={[styles.page, wide && styles.wide]}>
          <View style={wide ? styles.side : undefined}>{summary}</View>
          <View style={{ flex: 1 }}>
            <Card>
              <Text style={styles.section}>Данс</Text>
              {accounts.length === 0 ? (
                <View>
                  <Text style={styles.hint}>Данс байхгүй тул хадгалахгүй. Бусад → Данс хэсгээс нэмнэ үү.</Text>
                  <Button title="Данс нэмэх" variant="outline" onPress={() => router.push('/account/new')} />
                </View>
              ) : null}
              <View style={styles.wrap}>
                {accounts.map((item) => (
                  <Chip key={item.id} label={item.name} active={accountId === item.id} onPress={() => setAccountId(item.id)} />
                ))}
              </View>
              {openingPlan?.action === 'set' ? (
                <View style={styles.rowBetween}>
                  <Text style={styles.hint}>Эхний үлдэгдлийг {formatCents(openingPlan.nextCents)} болгох. Данс хоосон, давхар тоолохгүй.</Text>
                  <Switch
                    accessibilityLabel="Эхний үлдэгдлийг хуулгаас авах"
                    value={applyOpening}
                    onValueChange={setApplyOpening}
                  />
                </View>
              ) : null}
              {openingPlan?.action === 'locked' ? (
                <Text style={styles.warn}>
                  {openingPlan.reason === 'has_transactions'
                    ? 'Дансанд гүйлгээ байгаа тул эхний үлдэгдлийг өөрчлөхгүй. Зөвхөн шинэ мөрүүдийг нэмнэ.'
                    : 'Дансны эхний үлдэгдэл өөр байна. Чимээгүй дарж бичихгүй.'}
                </Text>
              ) : null}
              {openingPlan?.action === 'unchanged' && openingPlan.reason === 'matches' ? (
                <Text style={styles.hint}>Эхний үлдэгдэл хуулгатай адилхан тул дахин бичихгүй.</Text>
              ) : null}
            </Card>

            {rows.map((row) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                accessibilityLabel={`${row.occurredAt} ${row.note}`}
                onPress={() => setOpenId(openId === row.id ? null : row.id)}
                style={[styles.item, row.issues.length && !row.excluded ? styles.bad : null, row.excluded && styles.muted]}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{row.occurredAt || 'Огноогүй'} {row.postedTime} · {row.lineNo ? `№${row.lineNo}` : ''}</Text>
                  <Text style={{ color: (row.amountCents ?? 0) > 0 ? colors.income : colors.expense, fontWeight: '700' }}>
                    {row.amountCents == null ? '—' : formatCents(row.amountCents)}
                  </Text>
                </View>
                <Text style={styles.hint} numberOfLines={openId === row.id ? undefined : 2}>{row.note || row.sourcePreview || 'Утгагүй'}</Text>
                <Text style={styles.meta}>
                  {kindLabel(row.kind)}
                  {row.categoryName ? ` · ${row.categoryName}` : ''}
                  {row.confidence === 'low' ? ' · бага итгэл' : ''}
                  {row.confidence === 'none' ? ' · ангилаагүй' : ''}
                  {dupIds.has(row.id) ? ' · давхардсан' : ''}
                  {row.excluded ? ' · хассан' : ''}
                </Text>
                {row.issues.map((issue) => <Text key={issue} style={styles.warn}>{issue}</Text>)}
                {openId === row.id ? (
                  <View>
                    <Text style={styles.hint}>{row.reason}</Text>
                    <Input label="Огноо" value={row.occurredAt} onChangeText={(value) => patchRow(row.id, { occurredAt: value })} />
                    <Input label="Цаг" value={row.postedTime} onChangeText={(value) => patchRow(row.id, { postedTime: value })} />
                    <Input
                      label="Дүн (хасах нь зарлага)"
                      value={amountDraft[row.id] ?? (row.amountCents == null ? '' : (row.amountCents / 100).toFixed(2))}
                      onChangeText={(value) => {
                        setAmountDraft((draft) => ({ ...draft, [row.id]: value }));
                        const cents = parseUserMoney(value);
                        if (cents == null) return;
                        const opening = row.openingCents ?? 0;
                        patchRow(row.id, { amountCents: cents, closingCents: opening + cents }, true);
                      }}
                    />
                    <Input label="Утга" value={row.note} onChangeText={(value) => patchRow(row.id, { note: value })} />
                    <View style={styles.wrap}>
                      {KINDS.map((kind) => (
                        <Chip key={kind} label={kindLabel(kind)} active={row.kind === kind} onPress={() => patchRow(row.id, { kind, categoryName: kind === 'normal' ? row.categoryName : null })} />
                      ))}
                    </View>
                    <View style={styles.wrap}>
                      {categories
                        .filter((category) => category.type === ((row.amountCents ?? 0) > 0 ? 'income' : 'expense'))
                        .map((category) => (
                          <Chip
                            key={category.id}
                            label={category.name}
                            color={category.color}
                            active={row.categoryName === category.name}
                            onPress={() => patchRow(row.id, { categoryName: category.name, kind: 'normal', confidence: 'high' })}
                          />
                        ))}
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={styles.hint}>Энэ мөрийг хадгалахгүй</Text>
                      <Switch accessibilityLabel="Мөрийг хасах" value={row.excluded} onValueChange={(value) => patchRow(row.id, { excluded: value })} />
                    </View>
                  </View>
                ) : null}
              </Pressable>
            ))}

            <Button
              title={offline ? 'Интернэтгүй тул хадгалахгүй' : 'Эдгээр гүйлгээг хадгалах'}
              onPress={save}
              disabled={offline || blocking || !accountId || phase === 'saving'}
              loading={phase === 'saving'}
            />
            {blocking ? <Text style={styles.warn}>Зөрүүтэй мөрийг засах эсвэл хассаны дараа хадгална. Чимээгүй алгасахгүй.</Text> : null}
          </View>
        </ScrollView>
      ) : null}

      {phase === 'done' && result ? (
        <View style={styles.page}>
          <Card>
            <Text style={styles.section}>{result.already_imported ? 'Энэ файл аль хэдийн орсон' : 'Хадгаллаа'}</Text>
            <Text style={styles.hint}>Нэмсэн: {result.inserted}. Давхардсан тул алгассан: {result.duplicates}. Хассан: {result.excluded}.</Text>
            <Text style={styles.hint}>{result.applied_opening ? 'Эхний үлдэгдлийг хоосон дансанд тавьсан.' : 'Эхний үлдэгдлийг өөрчлөөгүй.'}</Text>
            <Button title="Тайлан харах" onPress={() => router.push('/home')} />
            <Button title="Гүйлгээ харах" variant="outline" onPress={() => router.push('/transactions')} style={{ marginTop: 10 }} />
          </Card>
        </View>
      ) : null}
      </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  wide: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  side: { width: 340 },
  center: { flex: 1, justifyContent: 'center', padding: 16 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  line: { color: colors.text, fontSize: 14, marginBottom: 4 },
  warn: { color: colors.expense, fontSize: 13, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  item: { backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8 },
  bad: { borderWidth: 1, borderColor: colors.expense },
  muted: { opacity: 0.55 },
  itemTitle: { fontWeight: '700', color: colors.text, flex: 1 },
  meta: { color: colors.transfer, fontSize: 12, marginBottom: 4 },
});
