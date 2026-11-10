'use client';
import { useMemo, useState } from 'react';
import { post, usePoll } from '@/lib/hooks';

type Entry = {
  key: string;
  category: string;
  label: string;
  multiline: boolean;
  default: string;
  value: string;
  overridden: boolean;
  hasHistory: boolean;
};

// Lightweight spell/wording checker: common misspellings → suggestions. Purely
// advisory — it never blocks saving.
const COMMON_FIXES: Record<string, string> = {
  recieve: 'receive', recieved: 'received', seperate: 'separate', occured: 'occurred',
  untill: 'until', wich: 'which', teh: 'the', adress: 'address', withdrawl: 'withdrawal',
  succesful: 'successful', successfull: 'successful', transcation: 'transaction',
  paymnet: 'payment', availabe: 'available', balnce: 'balance', acount: 'account',
  verifcation: 'verification', loggin: 'login', pls: 'please',
  conversaton: 'conversation', merchnat: 'merchant', cryptocurrecy: 'cryptocurrency',
};

function spellingHints(text: string): { word: string; suggestion: string }[] {
  const hints: { word: string; suggestion: string }[] = [];
  const seen = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z']+/g) ?? []) {
    if (COMMON_FIXES[raw] && !seen.has(raw)) {
      seen.add(raw);
      hints.push({ word: raw, suggestion: COMMON_FIXES[raw] });
    }
  }
  return hints;
}

export default function AdminSiteContent() {
  const { data, refresh } = usePoll<{ entries: Entry[]; categories: string[] }>('/api/admin/content', 0);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const entries = data?.entries ?? [];
  const categories = ['All', ...(data?.categories ?? [])];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (cat !== 'All' && e.category !== cat) return false;
      if (!needle) return true;
      return (
        e.label.toLowerCase().includes(needle) ||
        e.key.toLowerCase().includes(needle) ||
        e.value.toLowerCase().includes(needle) ||
        e.default.toLowerCase().includes(needle)
      );
    });
  }, [entries, q, cat]);

  const grouped = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of filtered) {
      if (!m.has(e.category)) m.set(e.category, []);
      m.get(e.category)!.push(e);
    }
    return [...m.entries()];
  }, [filtered]);

  async function act(action: string, key: string, value?: string) {
    setBusy(key + action);
    try {
      await post('/api/admin/content', { action, key, value });
      setDrafts((d) => {
        const n = { ...d };
        delete n[key];
        return n;
      });
      setToast(action === 'save' ? 'Saved and published' : action === 'reset' ? 'Reset to default' : 'Previous version restored');
      setTimeout(() => setToast(''), 2500);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-xl border border-line bg-panel p-4">
        <h3 className="font-bold">Content Management</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Edit user-facing wording across CediX. Changes publish to the website (and app, where supported) on save.
          Financial calculations, transaction records, API keys and security logic are not editable here, and critical
          payment/security disclosures must stay accurate.
        </p>
      </div>

      {/* Search + category filter */}
      <div className="sticky top-0 z-10 flex flex-wrap gap-2 bg-bg/80 py-1 backdrop-blur">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any word, sentence or key…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm"
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {!data && <p className="py-10 text-center text-sm text-muted">Loading…</p>}
      {data && filtered.length === 0 && <p className="py-10 text-center text-sm text-muted">No matching text.</p>}

      {grouped.map(([category, items]) => (
        <section key={category}>
          <h4 className="mb-2 mt-4 text-[13px] font-bold uppercase tracking-wide text-muted">{category}</h4>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((e) => {
              const draft = drafts[e.key] ?? e.value;
              const dirty = draft !== e.value;
              const hints = spellingHints(draft);
              return (
                <div key={e.key} className="rounded-xl border border-line bg-panel p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold">{e.label}</span>
                    {e.overridden && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">Edited</span>}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted">{e.key}</p>

                  {e.multiline ? (
                    <textarea
                      value={draft}
                      onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
                      rows={3}
                      className="mt-2 w-full resize-y rounded-lg border border-line bg-panel2 px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      value={draft}
                      onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
                      className="mt-2 w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm"
                    />
                  )}

                  {hints.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {hints.map((h) => (
                        <button
                          key={h.word}
                          onClick={() => setDrafts((d) => ({ ...d, [e.key]: draft.replace(new RegExp(`\\b${h.word}\\b`, 'gi'), h.suggestion) }))}
                          className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold"
                          title="Click to apply"
                        >
                          {h.word} → {h.suggestion}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button
                      disabled={!dirty || busy === e.key + 'save'}
                      onClick={() => act('save', e.key, draft)}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black disabled:opacity-30"
                    >
                      {busy === e.key + 'save' ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setPreview(draft)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted"
                    >
                      Preview
                    </button>
                    <button
                      disabled={!e.overridden || busy === e.key + 'reset'}
                      onClick={() => act('reset', e.key)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted disabled:opacity-30"
                      title={`Default: ${e.default}`}
                    >
                      Reset
                    </button>
                    <button
                      disabled={!e.hasHistory || busy === e.key + 'restore'}
                      onClick={() => act('restore', e.key)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted disabled:opacity-30"
                    >
                      Restore previous
                    </button>
                    {dirty && (
                      <button onClick={() => setDrafts((d) => { const n = { ...d }; delete n[e.key]; return n; })} className="text-xs text-muted underline">
                        Discard
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {preview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md rounded-2xl bg-panel2 p-5" onClick={(ev) => ev.stopPropagation()}>
            <h4 className="text-sm font-bold">Preview</h4>
            <p className="mt-3 whitespace-pre-line rounded-xl bg-panel p-4 text-sm">{preview || <span className="text-muted">(empty)</span>}</p>
            <button onClick={() => setPreview(null)} className="mt-4 w-full rounded-lg bg-white py-2 text-sm font-bold text-black">Close</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-up px-5 py-2.5 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
