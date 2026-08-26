'use client';
import { useState } from 'react';
import { SettingsUsers } from './SettingsUsers';
import { SettingsApp } from './SettingsApp';
import { SettingsDepartments } from './SettingsDepartments';
import { SettingsObjects } from './SettingsObjects';
import { SettingsWorks } from './SettingsWorks';
import { SettingsOrderChains } from './SettingsOrderChains';
import { SettingsAnnouncements } from './SettingsAnnouncements';
import { pillCls, PageHeader } from './ui';

// Порядок и состав вкладок — как в эталоне (SettingsHub), за вычетом ИП / Техника / Номенклатура —
// эти справочники по-прежнему используются в формах (наряды, заявки), просто без отдельного
// экрана управления в настройках.
const TABS = [
  { key: 'users', label: 'Люди' },
  { key: 'chains', label: 'Отделы и маршруты' },
  { key: 'objects', label: 'Объекты' },
  { key: 'works', label: 'Списки работ' },
  { key: 'ochains', label: 'Маршруты нарядов' },
  { key: 'ann', label: 'Объявления' },
  { key: 'data', label: 'Данные' },
];

export function SettingsView({ boot, me, reload }: { boot: any; me?: any; reload: () => void }) {
  const [tab, setTab] = useState('users');
  return (
    <div>
      <PageHeader title="Настройки" sub="Люди, отделы, объекты, справочники и маршруты согласования." accent="stone" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  className={pillCls(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="anim-tab-in">
        {tab === 'users' && <SettingsUsers boot={boot} reload={reload} />}
        {tab === 'chains' && <SettingsDepartments boot={boot} reload={reload} />}
        {tab === 'objects' && <SettingsObjects boot={boot} reload={reload} />}
        {tab === 'works' && <SettingsWorks boot={boot} reload={reload} />}
        {tab === 'ochains' && <SettingsOrderChains boot={boot} reload={reload} />}
        {tab === 'ann' && <SettingsAnnouncements />}
        {tab === 'data' && <SettingsApp me={me || boot.me || {}} />}
      </div>
    </div>
  );
}
