'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';

type ModEvent = {
  id: string;
  targetType: string;
  targetId: string;
  score: number;
  reasons: string[];
  action: string;
  resolved: boolean;
  createdAt: string;
  user: { username: string; email: string; riskScore: number; orbitBanned: boolean };
};

type AdminPost = {
  id: string;
  content: string;
  status: string;
  modScore: number;
  modReasons: string[] | null;
  likeCount: number;
  createdAt: string;
  mediaUrls: string[] | null;
  author: { username: string; email: string; orbitBanned: boolean; riskScore: number };
};

export default function AdminContent() {
  const [sub, setSub] = useState<'queue' | 'posts'>('queue');
  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setSub('queue')} className={`rounded-lg px-4 py-2 text-sm font-medium ${sub === 'queue' ? 'bg-panel2 text-white' : 'text-muted'}`}>
          Moderation Queue
        </button>
        <button onClick={() => setSub('posts')} className={`rounded-lg px-4 py-2 text-sm font-medium ${sub === 'posts' ? 'bg-panel2 text-white' : 'text-muted'}`}>
          All Orbit Posts
        </button>
      </div>
      {sub === 'queue' ? <Queue /> : <Posts />}
    </div>
  );
}

function Queue() {
  const { data, refresh } = usePoll<{ events: ModEvent[] }>('/api/admin/moderation', 15000);
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string, decision: 'approve' | 'remove' | 'block') {
    setBusy(id);
    try {
      await post(`/api/admin/moderation/${id}`, { decision });
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const events = data?.events ?? [];
  return (
    <div className="space-y-3">
      {events.length === 0 && (
        <div className="rounded-xl border border-line bg-panel py-12 text-center text-muted">
          🎉 Moderation queue is clear — the AI handled everything.
        </div>
      )}
      {events.map((e) => (
        <div key={e.id} className="rounded-xl border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${e.score >= 60 ? 'bg-down/20 text-down' : 'bg-gold/20 text-gold'}`}>
              AI score: {e.score.toFixed(0)}
            </span>
            <span className="text-xs text-muted">{e.targetType}</span>
            <span className="font-semibold">@{e.user.username}</span>
            <span className="text-xs text-muted">risk {e.user.riskScore}{e.user.orbitBanned ? ' · BANNED' : ''}</span>
            <span className="ml-auto text-xs text-muted">{timeAgo(e.createdAt)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {e.reasons.map((r) => (
              <span key={r} className="rounded bg-panel2 px-2 py-0.5 text-[11px] text-muted">{r}</span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={busy === e.id} onClick={() => resolve(e.id, 'approve')} className="rounded border border-up/50 px-3 py-1.5 text-xs text-up disabled:opacity-40">
              ✓ Approve & Restore
            </button>
            <button disabled={busy === e.id} onClick={() => resolve(e.id, 'remove')} className="rounded border border-line px-3 py-1.5 text-xs text-muted disabled:opacity-40">
              Remove Content
            </button>
            <button disabled={busy === e.id} onClick={() => resolve(e.id, 'block')} className="rounded border border-down/50 px-3 py-1.5 text-xs text-down disabled:opacity-40">
              ⛔ Remove + Block User
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Posts() {
  const [filter, setFilter] = useState('');
  const { data, refresh } = usePoll<{ posts: AdminPost[] }>(`/api/admin/orbit${filter ? `?status=${filter}` : ''}`, 15000);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      await post(`/api/admin/orbit/${id}`, { status }, 'PATCH');
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {['', 'ACTIVE', 'FLAGGED', 'REMOVED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${filter === s ? 'bg-panel2 text-white' : 'text-muted'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {(data?.posts ?? []).map((p) => (
          <div key={p.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">@{p.author.username}</span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                  p.status === 'ACTIVE' ? 'bg-up/15 text-up' : p.status === 'FLAGGED' ? 'bg-gold/15 text-gold' : 'bg-down/15 text-down'
                }`}
              >
                {p.status}
              </span>
              {p.modScore > 0 && <span className="text-xs text-muted">AI score {p.modScore.toFixed(0)}</span>}
              <span className="ml-auto text-xs text-muted">{timeAgo(p.createdAt)} · ❤️ {p.likeCount}</span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-foreground/90">{p.content}</p>
            {(p.mediaUrls ?? []).length > 0 && <div className="mt-1 text-xs text-muted">📎 {(p.mediaUrls ?? []).length} media attachment(s)</div>}
            <div className="mt-3 flex gap-2">
              {p.status !== 'ACTIVE' && (
                <button disabled={busy === p.id} onClick={() => setStatus(p.id, 'ACTIVE')} className="rounded border border-up/50 px-3 py-1 text-xs text-up disabled:opacity-40">
                  Restore
                </button>
              )}
              {p.status !== 'REMOVED' && (
                <button disabled={busy === p.id} onClick={() => setStatus(p.id, 'REMOVED')} className="rounded border border-down/50 px-3 py-1 text-xs text-down disabled:opacity-40">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {(data?.posts ?? []).length === 0 && (
          <div className="rounded-xl border border-line bg-panel py-12 text-center text-muted">No posts.</div>
        )}
      </div>
    </div>
  );
}
