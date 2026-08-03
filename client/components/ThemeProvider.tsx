'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';

type ThemeCtx = {
  dark: boolean;
  /** переключить тему по действию пользователя — применяется и сохраняется на сервере */
  toggleTheme: () => void;
  /** подтянуть тему из данных сервера (после логина/загрузки) — без обратной записи */
  syncTheme: (dark: boolean) => void;
};
const ThemeContext = createContext<ThemeCtx | null>(null);

/** Тема приложения одним источником правды: применяет класс `dark` на <html>
 *  и хранит состояние в контексте, чтобы любой компонент читал/переключал
 *  тему через useTheme() без прокидывания пропсов через всё дерево. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // стабильные ссылки на функции — чтобы эффекты, зависящие от них (например, загрузка
  // данных при входе), не перезапускались всякий раз при переключении темы
  const syncTheme = useCallback((v: boolean) => setDark(v), []);
  const toggleTheme = useCallback(() => {
    setDark((v) => {
      const next = !v;
      api.settings.theme(next ? 'dark' : '').catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<ThemeCtx>(() => ({ dark, toggleTheme, syncTheme }), [dark, toggleTheme, syncTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
