'use client';
import { useEffect, useRef, useState } from 'react';

function readParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

function writeParam(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (value === null || value === '') url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/**
 * Состояние, синхронизированное с query-параметром URL (через replaceState — не плодит записи
 * в истории браузера при каждом переключении). Переживает перезагрузку страницы: при заходе
 * читается текущее значение параметра, при изменении — URL обновляется автоматически.
 * `null` = параметр отсутствует в URL (используем для «ничего не открыто»/значения по умолчанию).
 */
export function useUrlState(key: string, initial: string | null = null) {
  const [value, setValue] = useState<string | null>(() => readParam(key) ?? initial);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; } // не переписываем URL на первом рендере
    writeParam(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
