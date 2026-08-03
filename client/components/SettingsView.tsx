'use client';
import { useState } from 'react';
import { SettingsUsers } from './SettingsUsers';
import { SettingsApp } from './SettingsApp';
import { SettingsDicts } from './SettingsDicts';
import { SettingsChains } from './SettingsChains';
import { SettingsWorks } from './SettingsWorks';
import { pillCls, PageHeader } from './ui';

const TABS = [
  { key: 'users', label: 'Люди' },
  { key: 'app', label: 'Приложение' },
  { key: 'dicts', label: 'Отделы · Объекты · ИП · Номенклатура' },
  { key: 'chains', label: 'Маршруты' },
  { key: 'works', label: 'Справочники работ' },
];

export function SettingsView({ boot, me, reload }: { boot: any; me?: any; reload: () => void }) {
  const [tab, setTab] = useState('users');
  return (
    <div>
      <PageHeader title="Настройки" sub="Люди, маршруты согласования, справочники и оформление." accent="stone" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  className={pillCls(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <SettingsUsers boot={boot} reload={reload} />}
      {tab === 'app' && <SettingsApp me={me || boot.me || {}} />}
      {tab === 'dicts' && <SettingsDicts boot={boot} reload={reload} />}
      {tab === 'chains' && <SettingsChains boot={boot} reload={reload} />}
      {tab === 'works' && <SettingsWorks boot={boot} reload={reload} />}
    </div>
  );
}
