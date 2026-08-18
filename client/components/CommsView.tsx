'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { appConfirm, inputCls, pillCls } from './ui';

const card = 'rounded-2xl border border-stone-200 bg-white shadow-sm';
const btn = 'rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50';
const btnGhost = 'rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50';

/** «Мессенджер»: односторонние сообщения админу, анонимка, объявления (без сокетов — решение заказчика).
 *  Данные подтягиваются при открытии вкладки; кнопка «Обновить» перечитывает списки. */
export function CommsView({ me }: { me: any }) {
  const isAdmin = me.role === 'ADMIN';
  const [tab, setTab] = useState<'msg' | 'ann'>('msg');
  const [text, setText] = useState('');
  const [anon, setAnon] = useState('');
  const [sent, setSent] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [anons, setAnons] = useState<any[]>([]);
  const [anns, setAnns] = useState<any[]>([]);
  const [annText, setAnnText] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const a = await api.comms.announcements();
      setAnns(a);
      if (isAdmin) {
        const [m, an] = await Promise.all([api.comms.messages(), api.comms.anonList()]);
        setMessages(m); setAnons(an);
      }
    } catch (e: any) { setErr(e.message || 'Не удалось загрузить'); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (s: string) => new Date(s).toLocaleString('ru-RU');

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([['msg', 'Сообщения'], ['ann', 'Объявления']] as const).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
            className={pillCls(tab === k)}>{t}</button>
        ))}
        <button onClick={load} className={`${btnGhost} ml-auto`}>Обновить</button>
      </div>
      {err && <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

      {tab === 'msg' && (
        <>
          <div className={`p-4 ${card}`}>
            <h2 className="mb-1 text-base font-semibold text-stone-900">Написать администратору</h2>
            <p className="mb-2 text-xs text-stone-500">Односторонний канал: сообщение попадёт в список администратора. Ответ — лично или объявлением.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              className={inputCls} placeholder="Текст сообщения…" />
            <div className="mt-2 flex items-center gap-2">
              <button className={btn} disabled={!text.trim()}
                onClick={async () => { await api.comms.send(text.trim()); setText(''); setSent('Сообщение отправлено администратору.'); setTimeout(() => setSent(''), 4000); if (isAdmin) load(); }}>
                Отправить
              </button>
              {sent && <span className="text-sm text-emerald-600">{sent}</span>}
            </div>
          </div>

          <div className={`p-4 ${card}`}>
            <h2 className="mb-1 text-base font-semibold text-stone-900">Анонимно руководству</h2>
            <p className="mb-2 text-xs text-stone-500">Автор не сохраняется нигде — ни в сообщении, ни в журналах.</p>
            <textarea value={anon} onChange={(e) => setAnon(e.target.value)} rows={2}
              className={inputCls} placeholder="Анонимное сообщение…" />
            <button className={`${btn} mt-2`} disabled={!anon.trim()}
              onClick={async () => { await api.comms.anonSend(anon.trim()); setAnon(''); setSent('Отправлено анонимно.'); setTimeout(() => setSent(''), 4000); if (isAdmin) load(); }}>
              Отправить анонимно
            </button>
          </div>

          {isAdmin && (
            <div className={`p-4 ${card}`}>
              <h2 className="mb-2 text-base font-semibold text-stone-900">Входящие ({messages.filter((m) => !m.readAt).length} новых)</h2>
              <div className="space-y-3">
                {messages.length === 0 && <p className="text-sm text-stone-400">Сообщений нет.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-lg border px-3 py-2 ${m.readAt ? 'border-stone-200' : 'border-amber-300 bg-amber-50'}`}>
                    <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                      <span className="font-medium text-stone-700">{m.fromName}</span><span>{fmt(m.createdAt)}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{m.text}</div>
                    {!m.readAt && (
                      <button className="mt-1 text-xs text-stone-500 underline"
                        onClick={async () => { await api.comms.markRead(m.id); load(); }}>отметить прочитанным</button>
                    )}
                  </div>
                ))}
              </div>
              <h3 className="mb-2 mt-5 text-sm font-semibold text-stone-700">Анонимные</h3>
              <div className="space-y-2">
                {anons.length === 0 && <p className="text-sm text-stone-400">Пусто.</p>}
                {anons.map((a) => (
                  <div key={a.id} className="rounded-lg border border-stone-200 px-3 py-2">
                    <div className="text-xs text-stone-400">{fmt(a.createdAt)} · аноним</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{a.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'ann' && (
        <div className={`p-4 ${card}`}>
          {isAdmin && (
            <div className="mb-4 flex gap-2">
              <input value={annText} onChange={(e) => setAnnText(e.target.value)} placeholder="Текст объявления…"
                className={`flex-1 ${inputCls}`} />
              <button className={btn} disabled={!annText.trim()}
                onClick={async () => { await api.comms.addAnnouncement(annText.trim()); setAnnText(''); load(); }}>Опубликовать</button>
            </div>
          )}
          <div className="space-y-3">
            {anns.length === 0 && <p className="text-sm text-stone-400">Объявлений нет.</p>}
            {anns.map((a) => (
              <div key={a.id} className={`rounded-lg border px-3 py-2 ${a.pinned ? 'border-amber-300 bg-amber-50' : 'border-stone-200'}`}>
                <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                  <span>{a.pinned ? '📌 ' : ''}{a.byName} · {fmt(a.createdAt)}</span>
                  <span className="flex gap-2">
                    {!a.readByMe && <button className="underline" onClick={async () => { await api.comms.readAnnouncement(a.id); load(); }}>прочитано</button>}
                    {isAdmin && <button className="underline" onClick={async () => { await api.comms.pinAnnouncement(a.id); load(); }}>{a.pinned ? 'открепить' : 'закрепить'}</button>}
                    {isAdmin && <button className="text-rose-600 underline" onClick={async () => { if (await appConfirm('Удалить объявление?', { okText: 'Удалить', danger: true })) { await api.comms.delAnnouncement(a.id); load(); } }}>удалить</button>}
                  </span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{a.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
