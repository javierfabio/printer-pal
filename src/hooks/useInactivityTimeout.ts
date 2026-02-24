import { useEffect, useCallback, useRef } from 'react';

const INACTIVITY_KEY = 'inactivity_timeout_minutes';
const DEFAULT_TIMEOUT = 30; // minutes

export function saveInactivityTimeout(minutes: number) {
  localStorage.setItem(INACTIVITY_KEY, String(minutes));
}

export function getInactivityTimeout(): number {
  const val = localStorage.getItem(INACTIVITY_KEY);
  return val ? parseInt(val, 10) : DEFAULT_TIMEOUT;
}

export function useInactivityTimeout(onTimeout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const minutes = getInactivityTimeout();
    if (minutes <= 0) return; // disabled
    timerRef.current = setTimeout(() => {
      onTimeout();
    }, minutes * 60 * 1000);
  }, [onTimeout]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handler = () => resetTimer();

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);
}
