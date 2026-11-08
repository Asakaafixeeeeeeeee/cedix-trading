'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';

type Banner = { id: string; title: string; body: string; link: string | null; active: boolean; sort: number };
type Announcement = { id: string; title: string; body: string | null; published: boolean; pinned: boolean; publishAt: string };

const input = 'w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent';

export default function AdminBanners() {
  return (
    <div className="space-y-10">
      <BannerManager />
      <AnnouncementManager />
    </div>
  );
}

function BannerManager() {
  const { data, refresh } = usePoll<{ banners: Banner[] }>('/api/admin/banners', 0);
  const [form, setForm] = useState({ title: '', body: '', link: '', sort: '0' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setBusy(true);
    setError('');
    try {
      await post('/api/admin/banners', { ...form, sort: Number(form.sort) });
      setForm({ title: '', body: '', link: '', sort: '0' });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Banner) {
    await post(`/api/admin/banners/${b.id}`, { active: !b.active }, 'PATCH');
    refresh();
  }

  async function remove(b: Banner) {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    await post(`/api/admin/banners/${b.id}`, undefined, 'DELETE');
    refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-panel p-5">
        <h3 className="font-bold">Create promotional banner</h3>
        <p className="mt-1 text-xs text-muted">Shown in the mobile app home carousel. Only advertise real features.</p>
        <div className="mt-4 space-y-3">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className={input} />
          <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Body text" rows={2} className={input} />
          <div className="flex gap-3">
            <input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="Link (e.g. /p2p)" className={input} />
            <input value={form.sort} onChange={(e) => setForm((f) => ({ ...f, sort: e.target.value }))} type="number" placeholder="Order" className="w-24 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none" />
          </div>
          {error && <p className="text-sm text-down">{error}</p>}
          <button onClick={create} disabled={busy || !form.title || !form.body} className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black disabled:opacity-40">
            {busy ? 'Creating…' : 'Create banner'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {(data?.banners ?? []).map((b) => (
          <div key={b.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{b.title}</div>
                <div className="mt-0.5 text-sm text-muted">{b.body}</div>
                <div className="mt-1 text-xs text-muted">{b.link || 'no link'} · order {b.sort}</div>
              </div>
              <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${b.active ? 'bg-up/15 text-up' : 'bg-panel2 text-muted'}`}>
                {b.active ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => toggle(b)} className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-medium hover:border-accent">
                {b.active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => remove(b)} className="rounded-lg border border-down/50 px-3.5 py-1.5 text-xs font-medium text-down">
                Delete
              </button>
            </div>
          </div>
        ))}
        {(data?.banners ?? []).length === 0 && (
          <div className="rounded-xl border border-line bg-panel py-10 text-center text-sm text-muted">No banners yet.</div>
        )}
      </div>
    </div>
  );
}

function AnnouncementManager() {
  const { data, refresh } = usePoll<{ announcements: Announcement[] }>('/api/admin/announcements', 0);
  const [form, setForm] = useState({ title: '', body: '', publishAt: '', pinned: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Announcement | null>(null);

  async function create() {
    setBusy(true);
    setError('');
    try {
      await post('/api/admin/announcements', {
        title: form.title,
        body: form.body,
        pinned: form.pinned,
        publishAt: form.publishAt || undefined,
      });
      setForm({ title: '', body: '', publishAt: '', pinned: false });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, patch: Record<string, unknown>) {
    await post(`/api/admin/announcements/${id}`, patch, 'PATCH');
    refresh();
  }

  async function remove(a: Announcement) {
    if (!confirm(`Delete announcement "${a.title}"?`)) return;
    await post(`/api/admin/announcements/${a.id}`, undefined, 'DELETE');
    refresh();
  }

  async function saveEdit() {
    if (!editing) return;
    await update(editing.id, { title: editing.title, body: editing.body });
    setEditing(null);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-panel p-5">
        <h3 className="font-semibold">Create announcement</h3>
        <p className="mt-1 text-xs text-muted">
          Published announcements appear on the home page. Schedule by setting a future publish time.
        </p>
        <div className="mt-4 space-y-3">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className={input} />
          <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Body (optional)" rows={3} className={input} />
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted">
              Publish at (optional)
              <input
                type="datetime-local"
                value={form.publishAt}
                onChange={(e) => setForm((f) => ({ ...f, publishAt: e.target.value }))}
                className="mt-1 block rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="flex items-center gap-2 pt-4 text-sm text-muted">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} className="h-4 w-4" />
              Pin
            </label>
          </div>
          {error && <p className="text-sm text-down">{error}</p>}
          <button onClick={create} disabled={busy || form.title.trim().length < 3} className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black disabled:opacity-40">
            {busy ? 'Creating…' : 'Create announcement'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {(data?.announcements ?? []).map((a) => (
          <div key={a.id} className="rounded-xl border border-line bg-panel p-4">
            {editing?.id === a.id ? (
              <div className="space-y-2">
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={input} />
                <textarea value={editing.body ?? ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={2} className={input} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="rounded-lg bg-white px-4 py-1.5 text-xs font-bold text-black">Save</button>
                  <button onClick={() => setEditing(null)} className="rounded-lg border border-line px-4 py-1.5 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{a.title}</div>
                    {a.body && <div className="mt-0.5 line-clamp-2 text-sm text-muted">{a.body}</div>}
                    <div className="num mt-1 text-xs text-muted">
                      {new Date(a.publishAt).toLocaleString()} {new Date(a.publishAt) > new Date() && '· scheduled'}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${a.published ? 'bg-up/15 text-up' : 'bg-panel2 text-muted'}`}>
                      {a.published ? 'PUBLISHED' : 'DRAFT'}
                    </span>
                    {a.pinned && <span className="rounded-md bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">PINNED</span>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => update(a.id, { published: !a.published })} className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-medium hover:border-accent">
                    {a.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => update(a.id, { pinned: !a.pinned })} className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-medium hover:border-accent">
                    {a.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button onClick={() => setEditing(a)} className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-medium hover:border-accent">
                    Edit
                  </button>
                  <button onClick={() => remove(a)} className="rounded-lg border border-down/50 px-3.5 py-1.5 text-xs font-medium text-down">
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {(data?.announcements ?? []).length === 0 && (
          <div className="rounded-xl border border-line bg-panel py-10 text-center text-sm text-muted">No announcements yet.</div>
        )}
      </div>
    </div>
  );
}
