'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Login } from '@/components/Login';
import { Shell, type ViewKey } from '@/components/Shell';
import { RequestsView } from '@/components/RequestsView';
import { BankView } from '@/components/BankView';
import { RequestDetail } from '@/components/RequestDetail';
import { NewRequest } from '@/components/NewRequest';
import { OrdersView } from '@/components/OrdersView';
import { NewOrder } from '@/components/NewOrder';
import { OrderDetail } from '@/components/OrderDetail';
import { PersonalHub } from '@/components/PersonalHub';
import { useTheme } from '@/components/ThemeProvider';
import { DialogHost, NotifBell, appConfirm } from '@/components/ui';
import { PrintDoc } from '@/components/PrintDoc';
import { BatchPrint } from '@/components/BatchPrint';

export default function Home() {
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [boot, setBoot] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loadErr, setLoadErr] = useState('');

  const [view, setView] = useState<ViewKey>('requests');
  const [openReq, setOpenReq] = useState<string | null>(null);
  const [newReq, setNewReq] = useState(false);
  const [openOrd, setOpenOrd] = useState<string | null>(null);
  const [newOrd, setNewOrd] = useState(false);
  const [printDoc, setPrintDoc] = useState<{ kind: 'request' | 'order' | 'order-summary'; data: any } | null>(null);
  const [batchIds, setBatchIds] = useState<string[] | null>(null);
  const [repeatFrom, setRepeatFrom] = useState<any>(null);
  const [appSettings, setAppSettings] = useState<any>(null);   // логотип, лимит «Срочно»
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [commsUnread, setCommsUnread] = useState(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [reloading, setReloading] = useState(false);
  const { syncTheme } = useTheme();

  const showOrders = !!me && (me.role === 'ADMIN' || me.ordersAccess ||
    orders.some((o) => o.chainSteps?.some((s: any) => s.approverId === me.id)));

  const loadAll = useCallback(async (withNotes = true) => {
    setLoadErr('');
    try {
      const [b, rs, os, ns] = await Promise.all([
        api.bootstrap(),
        api.requests.list(),
        api.orders.list(),
        withNotes ? api.notes.list() : Promise.resolve(null),
      ]);
      setBoot(b);
      setMe(b.me);
      api.settings.get().then(setAppSettings).catch(() => undefined);
      api.settings.avatarUrl(b.me.id).then((r: any) => setAvatarUrl(r.avatarUrl)).catch(() => undefined);
      // бейдж «Связь»: непрочитанные объявления (+ сообщения у админа)
      Promise.all([
        api.comms.announcements().catch(() => []),
        b.me.role === 'ADMIN' ? api.comms.messages().catch(() => []) : Promise.resolve([]),
      ]).then(([anns, msgs]: any[]) => {
        setCommsUnread((anns || []).filter((a: any) => !a.readByMe).length + (msgs || []).filter((m: any) => !m.readAt).length);
        setAnnouncements(anns || []);
      }).catch(() => undefined);
      syncTheme(b.me.theme === 'dark');
      setRequests(rs);
      setOrders(os);
      if (ns) setNotes(ns);
      return true;
    } catch (e: any) {
      setLoadErr(e?.message || 'Не удалось загрузить данные');
      return false;
    }
  }, [syncTheme]);

  // ручное «Обновить» в шапке/сайдбаре: без спиннера и ошибки клик выглядел так, будто
  // ничего не происходит (loadErr после первой загрузки нигде больше не показывается)
  const handleManualReload = async () => {
    setReloading(true);
    const ok = await loadAll();
    setReloading(false);
    if (!ok) appConfirm('Не удалось обновить данные. Проверьте соединение и попробуйте ещё раз.', { okText: 'Понятно' });
  };

  // восстановление сессии по refresh-cookie
  useEffect(() => {
    api.me()
      .then(async (u) => {
        if (u.isActive === false) { await api.logout().catch(() => {}); setChecking(false); return; }
        setMe(u); await loadAll(); setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // диплинк на конкретную заявку (?request=ID) — например ссылка «открыть в новой вкладке»
  // из карточки сводной заявки; открываем через «Банк», т.к. он не завязан на текущий раздел
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || !boot) return;
    const id = new URLSearchParams(window.location.search).get('request');
    if (id) {
      deepLinkHandled.current = true;
      setView('bank');
      setOpenReq(id);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [boot]);

  // фоновое обновление списков раз в 30 c (когда вкладка видима)
  useEffect(() => {
    if (!me) return;
    const iv = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      api.requests.list().then(setRequests).catch(() => {});
      api.orders.list().then(setOrders).catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, [me]);

  const onLogin = async (u: any) => { setMe(u); await loadAll(); };
  const onLogout = async () => {
    await api.logout();
    setMe(null); setBoot(null); setRequests([]); setOrders([]); setNotes([]);
    setView('requests'); setOpenReq(null); setOpenOrd(null); setNewReq(false); setNewOrd(false);
  };

  const replaceReq = (r: any) => setRequests((prev) => prev.map((x) => (x.id === r.id ? r : x)));
  const replaceOrd = (o: any) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)));

  const badges = useMemo(() => {
    if (!me) return {};
    const reqTurn = requests.filter((r) => r.status === 'APPROVAL' && r.chainSteps?.[r.currentStageIndex]?.approverId === me.id).length;
    const ordTurn = orders.filter((o) => o.status === 'APPROVAL' && o.chainSteps?.find((s: any) => s.order_ === o.currentStageIndex)?.approverId === me.id).length;
    return { requests: reqTurn, orders: ordTurn, personal: commsUnread } as Partial<Record<ViewKey, number>>;
  }, [requests, orders, me, commsUnread]);

  // события по МОИМ заявкам: что сделали другие за последние две недели
  const notifItems = useMemo(() => {
    if (!me) return [];
    const since = Date.now() - 14 * 86400000;
    const TXT: Record<string, string> = {
      APPROVED: 'согласована', REJECTED: 'отклонена', RETURNED: 'возвращена в снабжение',
      STOCK: 'отметка склада', FULFILLED: 'закуплена — подтвердите получение',
      CONSOLIDATED: 'включена в сводную', UNCONSOLIDATED: 'сводная расформирована', EDITED: 'изменена',
    };
    const out: any[] = [];
    for (const r of requests) {
      if (r.requesterId !== me.id) continue;
      for (const e of r.events || []) {
        if (e.byId === me.id || !TXT[e.action]) continue;
        if (new Date(e.at).getTime() < since) continue;
        out.push({ id: e.id, reqId: r.id, number: r.number, text: `${TXT[e.action]} · ${e.byName}`, at: e.at });
      }
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 30);
  }, [requests, me]);

  if (checking) return <main className="flex min-h-screen items-center justify-center text-stone-400">Загрузка…</main>;
  if (!me) return <><Login onDone={onLogin} /><DialogHost /></>;
  if (!boot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-stone-500">
        {loadErr ? (<><p>{loadErr}</p><button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white" onClick={() => loadAll()}>Повторить</button></>) : 'Загрузка данных…'}
      </main>
    );
  }

  if (printDoc) return <PrintDoc doc={printDoc} boot={boot} onClose={() => setPrintDoc(null)} />;
  if (batchIds) return <BatchPrint requests={requests.filter((r) => batchIds.includes(r.id))} boot={boot} onBack={() => setBatchIds(null)} />;

  const curReq = openReq ? requests.find((r) => r.id === openReq) : null;
  const curOrd = openOrd ? orders.find((o) => o.id === openOrd) : null;

  // общий экран карточки заявки: используется и из «Снабжения», и из «Банка» —
  // view не переключается при открытии, поэтому подсветка в меню и «Назад» остаются на исходном разделе
  const requestDetailNode = curReq && (
    <RequestDetail me={me} boot={boot} r={curReq} onBack={() => setOpenReq(null)}
                   onUpdated={replaceReq} onPrint={() => setPrintDoc({ kind: 'request', data: curReq })}
                   onOpenRequest={(id) => setOpenReq(id)} onReloadAll={() => loadAll(false)}
                   onRepeat={(r) => { setRepeatFrom({ type: r.type, note: r.note || '', objectId: r.objectId || '', priority: 'NORMAL', due: '', fields: r.fields || {}, items: (r.items || []).map((i: any) => ({ name: i.name, unit: i.unit, qty: i.qty, note: i.note || '' })) }); setOpenReq(null); setView('requests'); setNewReq(true); }} />
  );

  let content: any = null;
  if (view === 'requests') {
    content = newReq ? (
      <NewRequest me={me} boot={boot} initial={repeatFrom} settings={appSettings}
                  onBack={() => { setNewReq(false); setRepeatFrom(null); }}
                  onCreated={(r) => { setRequests((p) => [r, ...p]); setNewReq(false); setRepeatFrom(null); setOpenReq(r.id); }} />
    ) : curReq ? requestDetailNode : (
      <RequestsView me={me} boot={boot} requests={requests} onOpen={setOpenReq} onNew={() => setNewReq(true)}
                    onConsolidated={(r) => {
                      const srcIds = (r.consolidatedFrom || []).map((s: any) => s.id);
                      setRequests((p) => [r, ...p.map((x) => (srcIds.includes(x.id) ? { ...x, consolidatedIntoId: r.id, postponed: true } : x))]);
                      loadAll(false);
                      setOpenReq(r.id);
                    }}
                    onBatchPrint={(ids) => setBatchIds(ids)} onReloadAll={() => loadAll(false)} onReplace={replaceReq} />
    );
  } else if (view === 'bank') {
    content = curReq ? requestDetailNode : <BankView me={me} boot={boot} requests={requests} onOpen={setOpenReq} />;
  } else if (view === 'orders') {
    content = newOrd ? (
      <NewOrder me={me} boot={boot} onBack={() => setNewOrd(false)}
                onCreated={(o) => { setOrders((p) => [o, ...p]); setNewOrd(false); setOpenOrd(o.id); }} />
    ) : curOrd ? (
      <OrderDetail me={me} boot={boot} o={curOrd} onBack={() => setOpenOrd(null)}
                   onUpdated={replaceOrd} onPrint={() => setPrintDoc({ kind: 'order', data: curOrd })} />
    ) : (
      <OrdersView me={me} boot={boot} orders={orders} onOpen={setOpenOrd} onNew={() => setNewOrd(true)}
                  onSummary={(period) => setPrintDoc({ kind: 'order-summary', data: { period, orders: orders.filter((o) => o.period === period && o.status !== 'REJECTED') } })} />
    );
  } else if (view === 'personal') {
    content = (
      <PersonalHub me={me} boot={boot} requests={requests} orders={orders} notes={notes} setNotes={setNotes}
                   avatarUrl={avatarUrl} onAvatarChange={setAvatarUrl}
                   onOpenReq={(id) => { setView('requests'); setOpenReq(id); }}
                   onOpenReqInBank={(id) => { setView('bank'); setOpenReq(id); }}
                   onOpenOrder={(id) => { setView('orders'); setOpenOrd(id); }}
                   reload={() => loadAll(false)} />
    );
  }

  return (
    <Shell me={me} view={view} setView={(v) => { setView(v); setOpenReq(null); setOpenOrd(null); setNewReq(false); setNewOrd(false); }}
           badges={badges} showOrders={showOrders} onLogout={onLogout} onReload={handleManualReload} reloading={reloading} logoUrl={appSettings?.logoUrl || null} avatarUrl={avatarUrl}
           announcements={announcements}
           notif={<NotifBell items={notifItems} dark onOpen={(id) => { setView('requests'); setOpenReq(id); }} />}>
      {content}
      <DialogHost />
    </Shell>
  );
}
