'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { Card, Empty, btnPrimary, inputCls, PageHeader } from './ui';

export function Notebook({ notes, setNotes }: { notes: any[]; setNotes: (n: any[]) => void }) {
  const [selId, setSelId] = useState<string | null>(notes[0]?.id || null);
  const sel = notes.find((n) => n.id === selId) || null;
  const timer = useRef<any>(null);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const patch = (p: { title?: string; body?: string }) => {
    if (!sel) return;
    const next = notes.map((n) => (n.id === sel.id ? { ...n, ...p } : n));
    setNotes(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => api.notes.update(sel.id, p).catch(() => {}), 600);
  };

  const create = async () => {
    const n = await api.notes.create();
    setNotes([n, ...notes]);
    setSelId(n.id);
  };

  const remove = async (id: string) => {
    await api.notes.remove(id).catch(() => {});
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    if (selId === id) setSelId(next[0]?.id || null);
  };

  return (
    <div>
      <PageHeader title="Блокнот" sub="Личные заметки — видите только вы." accent="violet"
        right={<button onClick={create} className={btnPrimary}><Plus className="h-4 w-4" /> Заметка</button>} />
      {notes.length === 0 ? <Empty text="Заметок пока нет." /> : (
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="!p-2 md:col-span-1">
            {notes.map((n) => (
              <div key={n.id}
                   className={`group mb-1 flex cursor-pointer items-center rounded-lg px-2.5 py-2 ${selId === n.id ? 'bg-stone-900 text-white' : 'hover:bg-stone-50'}`}
                   onClick={() => setSelId(n.id)}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{n.title || 'Без названия'}</div>
                  <div className={`text-xs ${selId === n.id ? 'text-stone-300' : 'text-stone-400'}`}>{fmtDateTime(n.updatedAt)}</div>
                </div>
                <button className="ml-1 hidden text-stone-400 hover:text-rose-500 group-hover:block"
                        onClick={(e) => { e.stopPropagation(); remove(n.id); }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Card>
          {sel && (
            <Card className="md:col-span-2">
              <input className={`${inputCls} mb-2 font-semibold`} placeholder="Заголовок"
                     value={sel.title} onChange={(e) => patch({ title: e.target.value })} />
              <textarea className={`${inputCls} min-h-64`} placeholder="Текст заметки…"
                        value={sel.body} onChange={(e) => patch({ body: e.target.value })} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
