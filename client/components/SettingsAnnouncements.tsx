'use client';
import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, ErrorBox, btnPrimary, appConfirm } from './ui';

const fmt = (s: string) => new Date(s).toLocaleString('ru-RU');

/** «Объявления»: последнее показывается всем сотрудникам плашкой, пока каждый не закроет её — как в эталоне (AdminAnnouncements). */
export function SettingsAnnouncements() {
  const [text, setText] = useState('');
  const [anns, setAnns] = useState<any[]>([]);
  const [err, setErr] = useState('');

  const load = () => { api.comms.announcements().then(setAnns).catch((e) => setErr(e?.message || 'Не удалось загрузить')); };
  useEffect(() => { load(); }, []);

  const post = async () => {
    const t = text.trim(); if (!t) return;
    setErr('');
    try { await api.comms.addAnnouncement(t); setText(''); load(); } catch (e: any) { setErr(e?.message || 'Ошибка'); }
  };

  const list = [...anns].reverse();

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm leading-relaxed text-stone-500">Последнее объявление показывается всем сотрудникам плашкой поверх приложения, пока каждый не закроет её крестиком.</p>
      <ErrorBox msg={err} />
      <Card className="mb-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст объявления…"
          className="h-24 w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-100" />
        <button onClick={post} disabled={!text.trim()} className={`${btnPrimary} mt-2 disabled:opacity-40`}>
          <Megaphone className="h-4 w-4" /> Опубликовать
        </button>
      </Card>
      {list.length === 0 ? <p className="text-sm text-stone-400">Объявлений ещё не было.</p> : (
        <div className="space-y-2">
          {list.map((a: any) => (
            <Card key={a.id} className="flex items-start gap-2">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <div className="whitespace-pre-wrap text-sm text-stone-800">{a.text}</div>
                <div className="mt-1 text-xs text-stone-400">
                  {a.byName} · {fmt(a.createdAt)}
                  {a.pinned && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">закреплено</span>}
                </div>
              </div>
              <button onClick={async () => { await api.comms.pinAnnouncement(a.id); load(); }}
                className={a.pinned ? 'inline-flex items-center justify-center rounded-md bg-amber-100 p-1.5 text-amber-700 hover:bg-amber-200' : 'inline-flex items-center justify-center rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700'}
                title={a.pinned ? 'Открепить' : 'Закрепить для всех'}>📌</button>
              <button onClick={async () => { if (await appConfirm('Удалить объявление?', { okText: 'Удалить', danger: true })) { await api.comms.delAnnouncement(a.id); load(); } }}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-rose-600" title="Удалить">✕</button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
