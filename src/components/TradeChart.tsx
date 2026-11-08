'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

type K = { time: number; open: number; high: number; low: number; close: number; volume: number };

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

export default function TradeChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [interval, setItv] = useState('1h');

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#848e9c' },
      grid: { vertLines: { color: '#1c2128' }, horzLines: { color: '#1c2128' } },
      rightPriceScale: { borderColor: '#232931' },
      timeScale: { borderColor: '#232931', timeVisible: true },
      autoSize: true,
    });
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
    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;
    return () => {
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
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        {INTERVALS.map((i) => (
          <button
            key={i}
            onClick={() => setItv(i)}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              interval === i ? 'bg-panel2 text-white' : 'text-muted hover:text-white'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
