'use client';
import { useCallback, useState } from 'react';

/**
 * Замена `useState('')` для состояния ошибки форм — при появлении сообщения прокручивает
 * страницу наверх, чтобы пользователь увидел его, даже если успел проскроллить форму вниз
 * (например, длинный список позиций). Используется вместе с `<ErrorBox msg={err} />`,
 * которая обычно рендерится в самом верху формы/карточки.
 */
export function useErrorState(initial = '') {
  const [err, setErrRaw] = useState(initial);
  const setErr = useCallback((msg: string) => {
    setErrRaw(msg);
    if (msg && typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  return [err, setErr] as const;
}
