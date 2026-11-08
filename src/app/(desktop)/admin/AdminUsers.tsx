'use client';
import { useState } from 'react';
import { post, usePoll } from '@/lib/hooks';
import { fmtNum, timeAgo } from '@/lib/format';

type AdminUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string;
  status: string;
  kycLevel: number;
  orbitBanned: boolean;
  riskScore: number;
  createdAt: string;
  lastLoginAt: string | null;
  wallets: { asset: string; available: string; locked: string }[];
};

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, refresh } = usePoll<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`, 0);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, username, name…"
          className="w-80 rounded-lg border border-line bg-bg px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <button className="rounded-lg bg-panel2 px-4 py-2 text-sm font-medium">Search</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2.5 pl-4 font-medium">User</th>
              <th className="font-medium">Role</th>
              <th className="font-medium">Status</th>
              <th className="font-medium">KYC</th>
              <th className="font-medium">Risk</th>
              <th className="font-medium">Orbit</th>
              <th className="hidden font-medium md:table-cell">Joined</th>
              <th className="pr-4 text-right font-medium">Manage</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <tr key={u.id} className="border-t border-line/60">
                <td className="py-2.5 pl-4">
                  <div className="font-semibold">{u.username}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className={u.role === 'ADMIN' ? 'text-gold' : ''}>{u.role}</td>
                <td className={u.status === 'ACTIVE' ? 'text-up' : u.status === 'BLOCKED' ? 'text-down' : 'text-gold'}>{u.status}</td>
                <td className="num">L{u.kycLevel}</td>
                <td className={`num ${u.riskScore >= 2 ? 'text-down' : 'text-muted'}`}>{u.riskScore}</td>
                <td>{u.orbitBanned ? <span className="text-down">Banned</span> : <span className="text-muted">OK</span>}</td>
                <td className="hidden text-xs text-muted md:table-cell">{timeAgo(u.createdAt)}</td>
                <td className="pr-4 text-right">
                  <button onClick={() => setSelected(u)} className="rounded border border-line px-3 py-1 text-xs hover:border-accent">
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <UserModal user={selected} onClose={() => setSelected(null)} onChange={refresh} />}
    </div>
  );
}

function UserModal({ user, onClose, onChange }: { user: AdminUser; onClose: () => void; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [adjAsset, setAdjAsset] = useState('USDT');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [msg, setMsg] = useState('');

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setMsg('');
    try {
      await post(`/api/admin/users/${user.id}`, data, 'PATCH');
      onChange();
      setMsg('Updated ✓');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function adjust() {
    setBusy(true);
    setMsg('');
    try {
      await post(`/api/admin/users/${user.id}/adjust`, { asset: adjAsset, amount: parseFloat(adjAmount), note: adjNote });
      setMsg('Balance adjusted ✓');
      setAdjAmount('');
      onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const btn = 'rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">@{user.username}</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>
        <div className="text-sm text-muted">{user.email} · joined {timeAgo(user.createdAt)} · last login {user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'never'}</div>

        <h3 className="mt-5 text-sm font-semibold">Account Status</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => patch({ status: 'ACTIVE' })} className={btn}>Activate</button>
          <button disabled={busy} onClick={() => patch({ status: 'SUSPENDED' })} className={btn}>Suspend</button>
          <button disabled={busy} onClick={() => patch({ status: 'BLOCKED' })} className={`${btn} text-down`}>Block</button>
          <button disabled={busy} onClick={() => patch({ orbitBanned: !user.orbitBanned })} className={btn}>
            {user.orbitBanned ? 'Unban from Orbit' : 'Ban from Orbit'}
          </button>
          <button disabled={busy} onClick={() => patch({ resetRisk: true })} className={btn}>Reset risk score</button>
          <button disabled={busy} onClick={() => patch({ role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' })} className={`${btn} text-gold`}>
            {user.role === 'ADMIN' ? 'Revoke admin' : 'Make admin'}
          </button>
        </div>

        <h3 className="mt-5 text-sm font-semibold">KYC Level</h3>
        <div className="mt-2 flex gap-2">
          {[0, 1, 2, 3].map((l) => (
            <button
              key={l}
              disabled={busy}
              onClick={() => patch({ kycLevel: l })}
              className={`${btn} ${user.kycLevel === l ? 'border-accent text-accent' : ''}`}
            >
              L{l}
            </button>
          ))}
        </div>

        <h3 className="mt-5 text-sm font-semibold">Balances</h3>
        <div className="num mt-2 space-y-1 rounded-lg border border-line bg-bg p-3 text-xs">
          {user.wallets.length === 0 && <div className="text-muted">No wallets</div>}
          {user.wallets.map((w) => (
            <div key={w.asset} className="flex justify-between">
              <span className="font-semibold">{w.asset}</span>
              <span>{fmtNum(Number(w.available))} <span className="text-muted">(+{fmtNum(Number(w.locked))} locked)</span></span>
            </div>
          ))}
        </div>

        <h3 className="mt-5 text-sm font-semibold">Adjust Balance</h3>
        <div className="mt-2 flex gap-2">
          <input value={adjAsset} onChange={(e) => setAdjAsset(e.target.value.toUpperCase())} className="w-20 rounded-lg border border-line bg-bg px-2 py-2 text-sm outline-none" />
          <input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} type="number" placeholder="+credit / -debit" className="num w-36 rounded-lg border border-line bg-bg px-2 py-2 text-sm outline-none" />
          <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Note" className="flex-1 rounded-lg border border-line bg-bg px-2 py-2 text-sm outline-none" />
          <button disabled={busy || !adjAmount} onClick={adjust} className="rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">
            Apply
          </button>
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.includes('✓') ? 'text-up' : 'text-down'}`}>{msg}</p>}
      </div>
    </div>
  );
}
