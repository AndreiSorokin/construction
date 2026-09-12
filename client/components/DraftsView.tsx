'use client';
import { useEffect, useState } from 'react';
import { FileEdit, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { TYPE_RU, fmtDateTime } from '@/lib/format';
import { Card, Empty, ErrorBox, PageHeader, appConfirm } from './ui';

/** список черновиков заявок — только просмотр/переход/удаление, без интерфейса создания */
export function DraftsView({ onBack, onOpen }: { onBack: () => void; onOpen: (type: string) => void }) {
  const [drafts, setDrafts] = useState<any[] | null>(null);
  const [err, setErr] = useState('');

  const reload = () => {
    setErr('');
    api.comms.listDrafts().then(setDrafts).catch((e: any) => { setDrafts([]); setErr(e?.message || 'Не удалось загрузить черновики'); });
  };
  useEffect(() => { reload(); }, []);

  const discard = async (type: string) => {
    if (!(await appConfirm('Удалить черновик? Восстановить его будет нельзя.', { okText: 'Удалить', danger: true }))) return;
    await api.comms.clearDraft(type).catch(() => undefined);
    reload();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Черновики" sub="Незавершённые заявки — откройте, чтобы закончить и подать." accent="amber" onBack={onBack} />
      <ErrorBox msg={err} />
      {drafts === null ? null : drafts.length === 0 ? (
        <Empty text="Черновиков нет." />
      ) : (
        <div className="space-y-2">
          {drafts.map((d: any) => (
            <Card key={d.type} className="flex items-center gap-3">
              <button onClick={() => onOpen(d.type)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <FileEdit className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-stone-800">{TYPE_RU[d.type] || d.type}</div>
                  <div className="truncate text-sm text-stone-500">
                    {d.payload?.note || 'Без примечания'}
                    <span className="text-stone-400"> · сохранён {fmtDateTime(d.updatedAt)}</span>
                  </div>
                </div>
              </button>
              <button className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-rose-600"
                      title="Удалить черновик" onClick={() => discard(d.type)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
