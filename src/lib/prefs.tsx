'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Currency = 'USD' | 'GHS';
type Theme = 'light' | 'dark';

type Prefs = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** Live GHS per USD rate */
  rate: number | null;
  /** Format a USD amount in the user's preferred display currency */
  money: (usd: number, decimals?: number) => string;
};

const PrefsContext = createContext<Prefs>({
  theme: 'light',
  setTheme: () => {},
  currency: 'USD',
  setCurrency: () => {},
  rate: null,
  money: (usd) => `$${usd.toFixed(2)}`,
});

export function usePrefs() {
  return useContext(PrefsContext);
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [currency, setCurrencyState] = useState<Currency>('USD');
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem('cedix_theme');
      if (t === 'dark') {
        setThemeState('dark');
        document.documentElement.classList.add('dark');
      }
      const c = localStorage.getItem('cedix_currency');
      if (c === 'GHS') setCurrencyState('GHS');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch('/api/fx', { cache: 'no-store' });
        const data = await res.json();
        if (!stop && data?.rate > 0) setRate(data.rate);
      } catch {
        /* retry next cycle */
      }
    }
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('cedix_theme', t);
    } catch {}
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem('cedix_currency', c);
    } catch {}
  }, []);

  const money = useCallback(
    (usd: number, decimals = 2) => {
      if (currency === 'GHS' && rate) {
        return (
          'GH₵' +
          (usd * rate).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        );
      }
      return (
        '$' +
        usd.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      );
    },
    [currency, rate],
  );

  return (
    <PrefsContext.Provider value={{ theme, setTheme, currency, setCurrency, rate, money }}>
      {children}
    </PrefsContext.Provider>
  );
}

/** True after the component has mounted on the client. */
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

/**
 * Hydration-safe preferences for rendering currency/theme-dependent text.
 * Returns the defaults (USD / light) during SSR and the first client render,
 * then the user's saved preferences — preventing hydration mismatches.
 */
export function useDisplayPrefs() {
  const prefs = usePrefs();
  const hydrated = useHydrated();
  const currency = hydrated ? prefs.currency : 'USD';
  const rate = hydrated ? prefs.rate : null;
  const theme = hydrated ? prefs.theme : 'light';
  const money = useCallback(
    (usd: number, decimals = 2) => {
      if (currency === 'GHS' && rate) {
        return (
          'GH₵' +
          (usd * rate).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        );
      }
      return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },
    [currency, rate],
  );
  return { ...prefs, currency, rate, theme, money };
}
