'use client';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Filter, Plus, Search } from 'lucide-react';
import { Badge, Card, Empty, btnPrimary, btnGhost, pillCls, DueBadge, ObjectDot, BulkBar, appConfirm, appPrompt } from './ui';
import { STATUS_CLS, STATUS_RU, TYPE_RU, PRIORITY_RU, fmtDate } from '@/lib/format';
import { SupplyBoard } from './SupplyBoard';

const PRI_BORDER: Record<string, string> = {
  URGENT: 'border-l-rose-400', HIGH: 'border-l-amber-400', NORMAL: 'border-l-stone-300', LOW: 'border-l-stone-200',
};

// компактный стиль дропдаунов фильтра — как в «Доске снабжения» (SupplyBoard), для единого вида везде
const selectCls = 'rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-600 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-100';

function ReqCard({ r, boot, onOpen, selectable, selected }: { r: any; boot: any; onOpen: () => void; selectable?: boolean; selected?: boolean }) {
  const obj = boot.objects.find((o: any) => o.id === r.objectId);
  const requester = boot.users.find((u: any) => u.id === r.requesterId);
  return (
    <button onClick={onOpen} style={selected ? { outline: '2px solid #0f172a', outlineOffset: 2 } : undefined}
      className={`block w-full overflow-hidden rounded-lg border border-l-4 border-stone-200 bg-white p-2.5 text-left shadow-sm transition hover:border-stone-300 ${PRI_BORDER[r.priority] || ''}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{r.number}</span>
        <Badge cls={STATUS_CLS[r.status]}>{STATUS_RU[r.status]}</Badge>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-stone-700">
        {obj && <ObjectDot color={obj.color} />}
        <span className="min-w-0 truncate">{TYPE_RU[r.type]}{obj ? ` · ${obj.name}` : ''}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-stone-400">
        <span>{requester?.name || '—'}</span>
        <span className="flex items-center gap-1.5">
          <DueBadge due={r.due} status={r.status} />
          {r.priority !== 'NORMAL' ? PRIORITY_RU[r.priority] + ' · ' : ''}{fmtDate(r.createdAt)}
        </span>
      </div>
      {r.items?.length > 0 && <div className="mt-1 truncate text-xs text-stone-500">{r.items.map((i: any) => i.name).join(', ')}</div>}
    </button>
  );
}

export function RequestsView({ me, boot, requests, onOpen, onNew, onConsolidated, onBatchPrint, onReloadAll, onReplace }: {
  me: any; boot: any; requests: any[]; onOpen: (id: string) => void; onNew: () => void; onConsolidated?: (r: any) => void; onBatchPrint?: (ids: string[]) => void; onReloadAll?: () => void; onReplace?: (r: any) => void;
}) {
  const isSupply = me.role === 'SUPPLY';
  const tabs = useMemo(() => {
    const t: { key: string; label: string; count?: number }[] = [];
    const myTurn = requests.filter((r) => r.status === 'APPROVAL' && r.chainSteps?.[r.currentStageIndex]?.approverId === me.id);
    if (myTurn.length || me.role === 'APPROVER' || me.role === 'WAREHOUSE') t.push({ key: 'inbox', label: 'На согласовании у меня', count: myTurn.length });
    if (isSupply || me.role === 'ADMIN') t.push({ key: 'board', label: 'Доска снабжения' });
    t.push({ key: 'mine', label: 'Мои заявки' });
    t.push({ key: 'all', label: me.role === 'REQUESTER' ? 'Архив' : 'Все / архив' });
    return t;
  }, [requests, me, isSupply]);
  const [tab, setTab] = useState(tabs[0]?.key || 'mine');
  const [q, setQ] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [consErr, setConsErr] = useState('');
  const toggleSel = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkDecide = async (action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const c = await appPrompt('Причина отклонения (обязательна для всех выбранных):');
      if (c === null || !c.trim()) return;
      setBulkBusy(true);
      try { for (const id of selected) await api.requests.decide(id, 'reject', c.trim()); } finally { setBulkBusy(false); }
    } else {
      if (!(await appConfirm(`Согласовать выбранные заявки (${selected.length})?`, { okText: 'Согласовать' }))) return;
      setBulkBusy(true);
      try { for (const id of selected) await api.requests.decide(id, 'approve'); } finally { setBulkBusy(false); }
    }
    setSelecting(false); setSelected([]);
    if (onReloadAll) onReloadAll();
  };
  const consolidatable = (r: any) => r.status === 'SUPPLY' && !r.isConsolidated && !r.consolidatedIntoId && ['TMC','QUARRY','FUEL'].includes(r.type);
  const [ftype, setFtype] = useState('');
  const [fobj, setFobj] = useState('');
  const [dFrom, setDFrom] = useState('');
  const [dTo, setDTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = (ftype ? 1 : 0) + (fobj ? 1 : 0) + ((dFrom || dTo) ? 1 : 0);

  const filtered = useMemo(() => {
    let rs = requests;
    if (tab === 'inbox') rs = rs.filter((r) => r.status === 'APPROVAL' && r.chainSteps?.[r.currentStageIndex]?.approverId === me.id);
    if (tab === 'mine') rs = rs.filter((r) => r.requesterId === me.id && r.status !== 'DONE' && r.status !== 'REJECTED' && !r.consolidatedIntoId);
    if (tab === 'all') rs = me.role === 'REQUESTER' ? rs.filter((r) => r.requesterId === me.id && (r.status === 'DONE' || r.status === 'REJECTED')) : rs;
    if (ftype) rs = rs.filter((r) => r.type === ftype);
    if (fobj) rs = rs.filter((r) => r.objectId === fobj);
    if (dFrom) rs = rs.filter((r) => String(r.createdAt).slice(0, 10) >= dFrom);
    if (dTo) rs = rs.filter((r) => String(r.createdAt).slice(0, 10) <= dTo);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rs = rs.filter((r) =>
        r.number.toLowerCase().includes(s) ||
        (r.note || '').toLowerCase().includes(s) ||
        (r.items || []).some((i: any) => i.name.toLowerCase().includes(s)));
    }
    return rs;
  }, [requests, tab, q, ftype, fobj, dFrom, dTo, me]);

  const supplyBoard = tab === 'board';
  const canCreate = me.role === 'REQUESTER' || me.role === 'APPROVER' || me.role === 'ADMIN';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Снабжение</h1>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'inbox' && !selecting && filtered.length > 0 && (
            <button className={btnGhost} onClick={() => setSelecting(true)} title="Отметить несколько заявок и решить по ним разом">Выбрать</button>
          )}
          {tab === 'board' && (
            selecting ? (
              <>
                <span className="text-sm text-stone-500">Выбрано: {selected.length}</span>
                <button className={btnPrimary} disabled={selected.length < 2 || !selected.every((id) => { const rr = requests.find((x) => x.id === id); return rr && consolidatable(rr); })} onClick={async () => {
                  setConsErr('');
                  try {
                    const r = await api.requestsX.consolidate(selected);
                    setSelecting(false); setSelected([]);
                    if (onConsolidated) onConsolidated(r); else onOpen(r.id);
                  } catch (e: any) { setConsErr(e?.message || 'Не удалось объединить'); }
                }}>Объединить в заявку</button>
                {onBatchPrint && (
                  <button className={btnGhost} disabled={selected.length === 0} onClick={() => onBatchPrint(selected)}>Печать · {selected.length}</button>
                )}
                <button className={btnGhost} onClick={() => { setSelecting(false); setSelected([]); setConsErr(''); }}>Отмена</button>
              </>
            ) : (
              <button className={btnGhost} onClick={() => setSelecting(true)}
                title="Выбрать несколько активных заявок с позициями и объединить в сводную">Выбрать</button>
            )
          )}
          {canCreate && (
            <button onClick={onNew} className={btnPrimary}><Plus className="h-4 w-4" /> Новая заявка</button>
          )}
        </div>
      </div>

      {consErr && <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{consErr}</div>}
      {selecting && <p className="mb-2 text-xs text-stone-500">Нажимайте на карточки, чтобы выбрать. «Объединить» доступно для активных заявок с позициями (ТМЦ/карьер/ГСМ); «Печать» — для любых.</p>}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={pillCls(tab === t.key)}>
            {t.label}{t.count ? ` · ${t.count}` : ''}
          </button>
        ))}
      </div>

      {!supplyBoard && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5" style={{ minWidth: 170 }}>
              <Search className="h-4 w-4 shrink-0 text-stone-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="w-full min-w-0 bg-transparent text-sm focus:outline-none" />
            </div>
            <button onClick={() => setFiltersOpen((v) => !v)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${filtersOpen || activeFilters ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}>
              <Filter className="h-4 w-4" /> Фильтры
              {activeFilters > 0 && <span className={`rounded-full px-1.5 text-xs font-bold ${filtersOpen ? 'bg-white text-stone-900' : 'bg-amber-400 text-stone-900'}`}>{activeFilters}</span>}
            </button>
          </div>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {tab === 'all' && (<>
                  <input type="date" className={selectCls} value={dFrom} onChange={(e) => setDFrom(e.target.value)} title="С даты" />
                  <span className="text-xs text-stone-400">–</span>
                  <input type="date" className={selectCls} value={dTo} onChange={(e) => setDTo(e.target.value)} title="По дату" />
                </>)}
                <select className={selectCls} value={fobj} onChange={(e) => setFobj(e.target.value)}>
                  <option value="">Все объекты</option>
                  {boot.objects.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <select className={selectCls} value={ftype} onChange={(e) => setFtype(e.target.value)}>
                  <option value="">Все типы</option>
                  {Object.entries(TYPE_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {activeFilters > 0 && (
                  <button onClick={() => { setFtype(''); setFobj(''); setDFrom(''); setDTo(''); }}
                    className="shrink-0 text-xs font-medium text-stone-500 underline hover:text-stone-800">Сбросить</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selecting && tab === 'inbox' && (
        <BulkBar count={selected.length} busy={bulkBusy}
          onCancel={() => { setSelecting(false); setSelected([]); }}
          onApprove={() => bulkDecide('approve')} onReject={() => bulkDecide('reject')} />
      )}
      <div key={tab} className="anim-tab-in">
        {supplyBoard ? (
          <SupplyBoard me={me} boot={boot} requests={requests} onOpen={onOpen}
            onReplace={onReplace || (() => { if (onReloadAll) onReloadAll(); })}
            onReloadAll={onReloadAll || (() => {})}
            selecting={selecting} selected={selected} onToggleSel={toggleSel} selectableCheck={consolidatable} />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => <ReqCard key={r.id} r={r} boot={boot} onOpen={() => (selecting ? toggleSel(r.id) : onOpen(r.id))} selectable={selecting} selected={selected.includes(r.id)} />)}
            {filtered.length === 0 && <div className="md:col-span-2 xl:col-span-3"><Empty text="Заявок нет." /></div>}
          </div>
        )}
      </div>
    </div>
  );
}
