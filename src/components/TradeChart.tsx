'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

type K = { time: number; open: number; high: number; low: number; close: number; volume: number };

const MAIN_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
const MORE_INTERVALS = ['30m', '2h', '6h', '12h', '3d'];
const MA_CONFIG = [
  { period: 5, color: '#f0a500' },
  { period: 10, color: '#e252a6' },
  { period: 20, color: '#28b5c8' },
] as const;

function sma(klines: K[], period: number) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < klines.length; i++) {
    sum += klines[i].close;
    if (i >= period) sum -= klines[i - period].close;
    if (i >= period - 1) out.push({ time: klines[i].time as UTCTimestamp, value: sum / period });
  }
  return out;
}

export default function TradeChart({ symbol, precision = 2 }: { symbol: string; precision?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maRefs = useRef<ISeriesApi<'Line'>[]>([]);
  const [interval, setItv] = useState('15m');
  const [moreOpen, setMoreOpen] = useState(false);
  const [maValues, setMaValues] = useState<(number | null)[]>([null, null, null]);

  useEffect(() => {
    if (!containerRef.current) return;
    const dark = () => document.documentElement.classList.contains('dark');
    const palette = () =>
      dark()
        ? { text: '#848e9c', grid: '#1c2128', border: '#232931' }
        : { text: '#7e8694', grid: '#eef0f3', border: '#e6e8ec' };
    let p = palette();
    const chart = createChart(containerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: p.text, attributionLogo: false },
      grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
      rightPriceScale: { borderColor: p.border },
      timeScale: { borderColor: p.border, timeVisible: true },
      autoSize: true,
    });
    const observer = new MutationObserver(() => {
      p = palette();
      chart.applyOptions({
        layout: { background: { color: 'transparent' }, textColor: p.text, attributionLogo: false },
        grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
        rightPriceScale: { borderColor: p.border },
        timeScale: { borderColor: p.border, timeVisible: true },
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderUpColor: '#0ecb81',
      borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    maRefs.current = MA_CONFIG.map((cfg) =>
      chart.addSeries(LineSeries, {
        color: cfg.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }),
    );
    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function load(initial: boolean) {
      try {
        const res = await fetch(`/api/markets/klines?symbol=${symbol}&interval=${interval}&limit=300`, { cache: 'no-store' });
        const { klines } = (await res.json()) as { klines: K[] };
        if (stop || !candleRef.current || !klines) return;
        candleRef.current.setData(
          klines.map((k) => ({ time: k.time as UTCTimestamp, open: k.open, high: k.high, low: k.low, close: k.close })),
        );
        volRef.current?.setData(
          klines.map((k) => ({
            time: k.time as UTCTimestamp,
            value: k.volume,
            color: k.close >= k.open ? 'rgba(14,203,129,0.4)' : 'rgba(246,70,93,0.4)',
          })),
        );
        const latest: (number | null)[] = [];
        MA_CONFIG.forEach((cfg, i) => {
          const data = sma(klines, cfg.period);
          maRefs.current[i]?.setData(data);
          latest.push(data.length ? data[data.length - 1].value : null);
        });
        setMaValues(latest);
        if (initial) chartRef.current?.timeScale().fitContent();
      } catch {
        /* retry next tick */
      }
    }
    load(true);
    const t = setInterval(() => load(false), 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [symbol, interval]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex items-center gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5 no-scrollbar">
        {MAIN_INTERVALS.map((i) => (
          <button
            key={i}
            onClick={() => { setItv(i); setMoreOpen(false); }}
            className={`shrink-0 rounded px-2.5 py-1 text-xs font-semibold ${
              interval === i ? 'bg-panel2 text-foreground' : 'text-muted'
            }`}
          >
            {i === '1d' ? '1D' : i === '1w' ? '1W' : i}
          </button>
        ))}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={`shrink-0 rounded px-2.5 py-1 text-xs font-semibold ${
            MORE_INTERVALS.includes(interval) ? 'bg-panel2 text-foreground' : 'text-muted'
          }`}
        >
          {MORE_INTERVALS.includes(interval) ? interval : 'More'} ▾
        </button>
        {moreOpen && (
          <div className="absolute right-2 top-9 z-20 flex gap-1 rounded-xl border border-line bg-bg p-1.5 shadow-lg">
            {MORE_INTERVALS.map((i) => (
              <button
                key={i}
                onClick={() => { setItv(i); setMoreOpen(false); }}
                className={`rounded px-2.5 py-1.5 text-xs font-semibold ${interval === i ? 'bg-panel2' : 'text-muted'}`}
              >
                {i}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* MA legend (live values from real candles) */}
      <div className="num flex gap-3 px-3 py-1 text-[10px]">
        {MA_CONFIG.map((cfg, i) => (
          <span key={cfg.period} style={{ color: cfg.color }}>
            MA{cfg.period}: {maValues[i] != null ? maValues[i]!.toFixed(precision) : '—'}
          </span>
        ))}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
