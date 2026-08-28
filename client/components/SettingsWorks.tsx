'use client';
import { useMemo, useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { Card, ErrorBox, btnGhost, btnPrimary, inputCls, appConfirm } from './ui';

const HEADERS = ['Наименование', 'Ед.', 'Цена'] as const;
const safeFilename = (s: string) => (s || 'works').replace(/[<>:"/\\|?*]/g, '_');

// xlsx — тяжёлая библиотека (~140кб), нужна только на этом экране; статический import раздувал бы
// главный бандл для всех пользователей, включая тех, кто сюда никогда не заходит
const loadXlsx = () => import('xlsx');

function buildWorkbook(XLSX: Awaited<ReturnType<typeof loadXlsx>>, rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 50 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Работы');
  return wb;
}

/** читает .xlsx и проверяет, что колонки совпадают с образцом — иначе не гарантировать,
 *  что цифры/названия попадут в нужные поля */
async function parseWorkbookFile(file: File): Promise<{ name: string; unit: string; price: number }[]> {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('В файле нет листов с данными.');
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  if (rows.length === 0) throw new Error('Файл пуст.');
  const first = rows[0];
  if (!('Наименование' in first) || !('Цена' in first)) {
    throw new Error('Не найдены колонки «Наименование» и «Цена». Скачайте образец и заполните именно его, не переименовывая заголовки столбцов.');
  }
  const parsed = rows
    .map((r) => ({
      name: String(r['Наименование'] ?? '').trim(),
      unit: String(r['Ед.'] ?? '').trim() || 'шт',
      price: Number(r['Цена']) || 0,
    }))
    .filter((r) => r.name);
  if (!parsed.length) throw new Error('В файле нет ни одной строки с заполненным наименованием.');
  return parsed;
}

const KIND_RU: Record<string, string> = { STROY: 'Строительные', ELEKTRO: 'Электромонтажные' };

export function SettingsWorks({ boot, reload }: { boot: any; reload: () => void }) {
  const [err, setErr] = useState('');
  const [catId, setCatId] = useState(boot.workCatalogs[0]?.id || '');
  const [q, setQ] = useState('');
  const [nw, setNw] = useState({ name: '', unit: '', price: '' });
  const [impOpen, setImpOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ name: string; unit: string; price: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', kind: 'STROY' as 'STROY' | 'ELEKTRO' });

  const createCatalog = () => {
    if (!newCat.name.trim()) return;
    act(async () => {
      const c = await api.workCatalogs.create({ name: newCat.name.trim(), kind: newCat.kind });
      setCatId(c.id);
      setNewCat({ name: '', kind: 'STROY' });
      setNewCatOpen(false);
    });
  };

  const cat = boot.workCatalogs.find((c: any) => c.id === catId) || boot.workCatalogs[0];
  const items = useMemo(() => {
    const list = cat?.items || [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((i: any) => i.name.toLowerCase().includes(s)) : list;
  }, [cat, q]);

  const act = async (fn: () => Promise<any>) => {
    setErr(''); setBusy(true);
    try { await fn(); await reload(); } catch (e: any) { setErr(e?.message || 'Ошибка'); } finally { setBusy(false); }
  };

  const exportXlsx = async () => {
    const XLSX = await loadXlsx();
    const rows: (string | number)[][] = [[...HEADERS], ...(cat?.items || []).map((i: any) => [i.name, i.unit, Number(i.price)])];
    XLSX.writeFile(buildWorkbook(XLSX, rows), `${safeFilename(cat?.name)}.xlsx`);
  };

  const downloadTemplate = async () => {
    const XLSX = await loadXlsx();
    XLSX.writeFile(buildWorkbook(XLSX, [[...HEADERS]]), 'shablon-spisok-rabot.xlsx');
  };

  const onFile = async (file: File) => {
    setErr(''); setPendingImport(null);
    try {
      setPendingImport(await parseWorkbookFile(file));
    } catch (e: any) {
      setErr(e?.message || 'Не удалось прочитать файл.');
    }
  };

  const clearImport = () => { setPendingImport(null); if (fileRef.current) fileRef.current.value = ''; };

  const doImport = async (mode: 'replace' | 'append') => {
    if (!pendingImport) return;
    if (mode === 'replace' && !(await appConfirm(`Заменить весь список (${cat?.items?.length || 0} поз.) на ${pendingImport.length} новых?`, { okText: 'Заменить', danger: true }))) return;
    act(async () => { await api.workCatalogs.import(catId, mode, pendingImport); setImpOpen(false); clearImport(); });
  };

  if (boot.workCatalogs.length === 0) {
    return (
      <div>
        <ErrorBox msg={err} />
        <Card className="max-w-md">
          <p className="mb-3 text-sm text-stone-500">Справочников работ ещё нет. Создайте первый — работы в него можно будет добавить вручную или загрузить таблицей.</p>
          <div className="flex flex-wrap gap-2">
            <input className={`${inputCls} flex-1`} placeholder="Название, напр. «Строительные работы»" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
            <select className={inputCls} value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value as any })}>
              {Object.entries(KIND_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className={btnPrimary} disabled={busy || !newCat.name.trim()} onClick={createCatalog}><Plus className="h-4 w-4" /> Создать</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <ErrorBox msg={err} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {boot.workCatalogs.map((c: any) => (
          <button key={c.id} onClick={() => setCatId(c.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${catId === c.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}>
            {c.name} · {c.items.length}
          </button>
        ))}
        <button onClick={() => setNewCatOpen((v) => !v)}
                className="rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700">
          <Plus className="mr-1 inline h-3.5 w-3.5" />Новый список
        </button>
        <span className="flex-1" />
        <button className={btnGhost} onClick={exportXlsx} disabled={!cat}><Download className="h-4 w-4" /> Экспорт в Excel</button>
        <button className={btnGhost} onClick={() => setImpOpen(!impOpen)}><Upload className="h-4 w-4" /> Импорт</button>
      </div>

      {newCatOpen && (
        <Card className="anim-pop-in mb-3">
          <div className="flex flex-wrap gap-2">
            <input className={`${inputCls} flex-1`} placeholder="Название нового списка" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
            <select className={inputCls} value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value as any })}>
              {Object.entries(KIND_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className={btnPrimary} disabled={busy || !newCat.name.trim()} onClick={createCatalog}>Создать</button>
            <button className={btnGhost} onClick={() => setNewCatOpen(false)}>Отмена</button>
          </div>
        </Card>
      )}

      {impOpen && (
        <Card className="anim-pop-in mb-3">
          <ol className="mb-3 list-decimal space-y-0.5 pl-4 text-xs text-stone-500">
            <li>Скачайте образец таблицы — в нём уже готовые заголовки колонок.</li>
            <li>Впишите свои работы строками ниже заголовков.</li>
            <li>Загрузите файл обратно — если колонки совпадают с образцом, ниже появится подтверждение.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={downloadTemplate}><Download className="h-4 w-4" /> Скачать образец</button>
            <button className={btnGhost} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Выбрать файл .xlsx</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </div>
          {pendingImport && (
            <div className="anim-fade-in mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-2.5 text-sm">
              <span className="text-stone-700">Прочитано из файла: <b>{pendingImport.length}</b> поз.</span>
              <button className={btnPrimary} disabled={busy} onClick={() => doImport('append')}>Добавить к списку</button>
              <button className={btnGhost} disabled={busy} onClick={() => doImport('replace')}>Заменить список</button>
              <button className="text-xs text-stone-400 underline hover:text-stone-700" onClick={clearImport}>Отмена</button>
            </div>
          )}
        </Card>
      )}

      <Card className="mb-3">
        <div className="flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1`} placeholder="Новая работа — наименование" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
          <input className={`${inputCls} w-24`} placeholder="ед." value={nw.unit} onChange={(e) => setNw({ ...nw, unit: e.target.value })} />
          <input className={`${inputCls} w-28`} placeholder="цена" value={nw.price} onChange={(e) => setNw({ ...nw, price: e.target.value })} />
          <button className={btnPrimary} disabled={busy || !nw.name.trim() || !cat}
                  onClick={() => act(async () => {
                    await api.workCatalogs.addItem(catId, { name: nw.name.trim(), unit: nw.unit.trim() || 'шт', price: Number(nw.price.replace(',', '.')) || 0 });
                    setNw({ name: '', unit: '', price: '' });
                  })}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>

      <input className={`${inputCls} mb-2 w-72`} placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="!p-0">
        <div className="max-h-[28rem] overflow-x-auto overflow-y-auto">
          <table className="w-full text-sm" style={{ minWidth: 400 }}>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                <th className="p-2 pl-3">Наименование</th><th className="p-2">Ед.</th>
                <th className="p-2 pr-3 text-right">Цена</th><th className="p-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i: any) => (
                <tr key={i.id} className="border-b border-stone-100 last:border-0">
                  <td className="p-2 pl-3">
                    <input className="w-full bg-transparent outline-none" defaultValue={i.name}
                           onBlur={(e) => e.target.value !== i.name && act(() => api.workCatalogs.updateItem(catId, i.id, { name: e.target.value }))} />
                  </td>
                  <td className="p-2">
                    <input className="w-16 bg-transparent outline-none" defaultValue={i.unit}
                           onBlur={(e) => e.target.value !== i.unit && act(() => api.workCatalogs.updateItem(catId, i.id, { unit: e.target.value }))} />
                  </td>
                  <td className="p-2 pr-3 text-right">
                    <input className="w-24 bg-transparent text-right outline-none" defaultValue={money(Number(i.price))}
                           onBlur={(e) => {
                             const v = Number(e.target.value.replace(/\s/g, '').replace(',', '.'));
                             if (!isNaN(v) && v !== Number(i.price)) act(() => api.workCatalogs.updateItem(catId, i.id, { price: v }));
                           }} />
                  </td>
                  <td className="p-2 pr-3 text-right">
                    <button className="text-stone-300 hover:text-rose-600" onClick={() => act(() => api.workCatalogs.removeItem(catId, i.id))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-sm text-stone-400">{q ? 'Ничего не найдено.' : 'Список пуст.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
