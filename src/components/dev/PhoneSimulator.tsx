'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * iPhone 17 Pro Max simulator for development previews.
 * The live site runs inside the screen via a same-origin iframe, so every
 * page, button, animation and HMR update works exactly like the real app.
 */

// iPhone 17 Pro Max logical screen points
const SCREEN_W = 440;
const SCREEN_H = 956;
const FRAME_PAD = 13; // bezel width
const RADIUS = 72; // screen corner radius

const PAGES: [string, string][] = [
  ['Home', '/m'],
  ['Markets', '/m/markets'],
  ['Trade', '/m/trade/BTCUSDT'],
  ['Orbit', '/m/orbit'],
  ['Assets', '/m/assets'],
  ['Deposit', '/m/deposit'],
  ['Withdraw', '/m/withdraw'],
  ['Messages', '/messages'],
  ['Landing', '/'],
];

export default function PhoneSimulator() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState('/m');
  const [pathInput, setPathInput] = useState('/m');
  const [zoom, setZoom] = useState(0.72);
  const [landscape, setLandscape] = useState(false);
  const [dark, setDark] = useState(false);
  const [frame, setFrame] = useState(true);
  const [time, setTime] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Live clock for the status bar
  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, ''));
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, []);

  // Fit-to-window default zoom
  useEffect(() => {
    const h = window.innerHeight - 140;
    const fit = Math.min(1, h / (SCREEN_H + FRAME_PAD * 2 + 4));
    setZoom(Math.max(0.3, Math.round(fit * 100) / 100));
  }, []);

  const applyTheme = useCallback((nextDark: boolean) => {
    const win = iframeRef.current?.contentWindow;
    try {
      win?.localStorage.setItem('cedix_theme', nextDark ? 'dark' : 'light');
      win?.document.documentElement.classList.toggle('dark', nextDark);
    } catch {
      /* cross-origin or not ready */
    }
  }, []);

  function navigate(p: string) {
    setPath(p);
    setPathInput(p);
    setReloadKey((k) => k + 1);
  }

  const w = landscape ? SCREEN_H : SCREEN_W;
  const h = landscape ? SCREEN_W : SCREEN_H;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(1200px 800px at 50% -10%, #2c3040 0%, #15171e 55%, #0b0c10 100%)' }}
    >
      {/* ───────── Controls ───────── */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2.5">
        <select
          value={PAGES.some(([, p]) => p === path) ? path : ''}
          onChange={(e) => e.target.value && navigate(e.target.value)}
          className="h-8 rounded-lg border border-[#3a3f4d] bg-[#1d2027] px-2 text-[12px] text-[#e7e9ee] outline-none"
        >
          <option value="" disabled>Pages…</option>
          {PAGES.map(([label, p]) => (
            <option key={p} value={p}>{label}</option>
          ))}
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(pathInput.startsWith('/') ? pathInput : `/${pathInput}`);
          }}
        >
          <input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            spellCheck={false}
            className="h-8 w-44 rounded-lg border border-[#3a3f4d] bg-[#1d2027] px-2.5 text-[12px] text-[#e7e9ee] outline-none focus:border-[#5a6174]"
          />
        </form>

        <Ctl label="Refresh" onClick={() => setReloadKey((k) => k + 1)}>
          <path d="M21 12a9 9 0 11-2.6-6.4M21 3v6h-6" />
        </Ctl>
        <Ctl label="Rotate" onClick={() => setLandscape((v) => !v)}>
          <path d="M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M12 7v10M7 12h10" />
        </Ctl>
        <Ctl label="Zoom out" onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 100) / 100))}>
          <circle cx="11" cy="11" r="7" />
          <path d="M8 11h6M21 21l-4.3-4.3" />
        </Ctl>
        <span className="w-12 text-center text-[12px] font-medium text-[#9aa1b2]">{Math.round(zoom * 100)}%</span>
        <Ctl label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 100) / 100))}>
          <circle cx="11" cy="11" r="7" />
          <path d="M11 8v6M8 11h6M21 21l-4.3-4.3" />
        </Ctl>
        <Ctl
          label="Full screen"
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else stageRef.current?.closest('.fixed')?.requestFullscreen().catch(() => {});
          }}
        >
          <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
        </Ctl>
        <Ctl
          label={dark ? 'Light mode' : 'Dark mode'}
          active={dark}
          onClick={() => {
            const next = !dark;
            setDark(next);
            applyTheme(next);
          }}
        >
          {dark ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" />
            </>
          ) : (
            <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
          )}
        </Ctl>
        <Ctl label={frame ? 'Hide frame' : 'Show frame'} active={!frame} onClick={() => setFrame((v) => !v)}>
          <rect x="7" y="2.5" width="10" height="19" rx="3" />
          <path d="M10.5 19h3" />
        </Ctl>
      </div>

      {/* ───────── Phone stage ───────── */}
      <div className="flex flex-1 items-start justify-center overflow-auto pb-8">
        <div ref={stageRef} style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
          <div className="relative" style={{ filter: frame ? 'drop-shadow(0 50px 70px rgba(0,0,0,.65))' : 'none' }}>
            {/* Titanium body */}
            <div
              className="relative"
              style={{
                padding: frame ? FRAME_PAD : 0,
                borderRadius: frame ? RADIUS + FRAME_PAD : RADIUS,
                background: frame
                  ? 'linear-gradient(145deg,#f4f2ee 0%,#b9b5ae 18%,#6f6c66 45%,#8d8982 55%,#dcd9d3 82%,#a19d96 100%)'
                  : 'transparent',
                boxShadow: frame
                  ? 'inset 0 0 0 1.5px rgba(255,255,255,.55), inset 0 0 14px rgba(0,0,0,.35)'
                  : 'none',
              }}
            >
              {/* Side buttons (titanium) */}
              {frame && !landscape && (
                <>
                  <SideBtn side="left" top={178} height={34} /> {/* action button */}
                  <SideBtn side="left" top={238} height={62} /> {/* vol up */}
                  <SideBtn side="left" top={312} height={62} /> {/* vol down */}
                  <SideBtn side="right" top={252} height={96} /> {/* power */}
                  <SideBtn side="right" top={392} height={52} /> {/* camera control */}
                </>
              )}

              {/* Screen (black bezel) */}
              <div
                className="relative flex flex-col overflow-hidden"
                style={{
                  width: w,
                  height: h,
                  borderRadius: RADIUS,
                  background: dark ? '#0a0a0a' : '#ffffff',
                  boxShadow: frame ? 'inset 0 0 0 3.5px #000, inset 0 0 0 4.5px #1a1a1a' : 'none',
                }}
              >
                {/* Status bar (safe area) */}
                {!landscape && (
                  <div
                    className="relative flex shrink-0 items-start justify-between px-10 pt-[17px]"
                    style={{ height: 56, color: dark ? '#fff' : '#000' }}
                  >
                    <span className="w-14 text-center text-[16px] font-semibold tracking-tight" style={{ fontFamily: 'ui-rounded, -apple-system, system-ui' }}>
                      {time}
                    </span>
                    <span className="flex items-center gap-1.5 pt-[3px]">
                      {/* Signal */}
                      <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor">
                        <rect x="0" y="8" width="3" height="4" rx="1" />
                        <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                        <rect x="10" y="3" width="3" height="9" rx="1" />
                        <rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity=".4" />
                      </svg>
                      {/* Wi-Fi */}
                      <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
                        <path d="M8.5 9.6a2 2 0 011.6.8l-1.6 1.9-1.6-1.9a2 2 0 011.6-.8z" />
                        <path d="M8.5 5.6c1.6 0 3 .6 4.1 1.6l-1.3 1.6a3.9 3.9 0 00-5.6 0L4.4 7.2a6 6 0 014.1-1.6z" />
                        <path d="M8.5 1.5c2.7 0 5.2 1 7.1 2.8l-1.3 1.6A8.3 8.3 0 008.5 3.6 8.3 8.3 0 002.7 5.9L1.4 4.3A10.3 10.3 0 018.5 1.5z" />
                      </svg>
                      {/* Battery */}
                      <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
                        <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity=".4" />
                        <rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" />
                        <path d="M25.5 4.5v4a2.2 2.2 0 000-4z" fill="currentColor" opacity=".4" />
                      </svg>
                    </span>

                    {/* Dynamic Island */}
                    <div className="pointer-events-none absolute left-1/2 top-[11px] -translate-x-1/2">
                      <div className="relative h-[34px] w-[118px] rounded-full bg-[#000]" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.03)' }}>
                        <span className="absolute right-[10px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #233047 0%, #0a0d14 60%)' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Live site */}
                <iframe
                  key={`${reloadKey}-${path}`}
                  ref={iframeRef}
                  src={path}
                  title="CediX preview"
                  className="w-full flex-1 border-0 bg-[#fff]"
                  onLoad={() => applyTheme(dark)}
                />

                {/* Home indicator */}
                <div className="pointer-events-none absolute inset-x-0 bottom-[8px] flex justify-center">
                  <span className="h-[5px] w-[148px] rounded-full" style={{ background: dark ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.85)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ctl({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[#e7e9ee] transition-colors ${
        active ? 'border-[#6b7cff] bg-[#2b3250]' : 'border-[#3a3f4d] bg-[#1d2027] hover:bg-[#262a33]'
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function SideBtn({ side, top, height }: { side: 'left' | 'right'; top: number; height: number }) {
  return (
    <span
      className="absolute w-[4px] rounded-full"
      style={{
        top,
        height,
        [side]: -4,
        background: 'linear-gradient(90deg,#d8d5cf,#8a8680,#b7b3ac)',
        boxShadow: '0 1px 2px rgba(0,0,0,.4)',
      }}
    />
  );
}
