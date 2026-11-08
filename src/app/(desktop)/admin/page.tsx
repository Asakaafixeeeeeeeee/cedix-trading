'use client';
import { useState } from 'react';
import { usePoll, useUser } from '@/lib/hooks';
import { fmtGHS } from '@/lib/format';
import AdminUsers from './AdminUsers';
import AdminFinance from './AdminFinance';
import AdminContent from './AdminContent';
import AdminSettings from './AdminSettings';
import Link from 'next/link';

type Stats = {
  users: number;
  activeUsers: number;
  newUsers24h: number;
  orders: number;
  trades24h: number;
  depositCount: number;
  depositVolumeGHS: number;
  withdrawalCount: number;
  withdrawalVolumeGHS: number;
  posts: number;
  flagged: number;
  openDisputes: number;
};

const TABS = ['Overview', 'Users', 'Finance', 'Orbit & Moderation', 'Settings & Audit'] as const;

export default function AdminPage() {
  const { user, loading } = useUser();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');

  if (!loading && (!user || user.role !== 'ADMIN')) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-muted">You need administrator access to view this page.</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-white px-6 py-2.5 font-semibold text-black">Log in</Link>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <h1 className="text-2xl font-bold">⚙️ Admin Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Total control over users, Orbit content and financial transactions.</p>
      <div className="mt-5 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
              tab === t ? 'border-white text-white' : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'Overview' && <Overview />}
        {tab === 'Users' && <AdminUsers />}
        {tab === 'Finance' && <AdminFinance />}
        {tab === 'Orbit & Moderation' && <AdminContent />}
        {tab === 'Settings & Audit' && <AdminSettings />}
      </div>
    </div>
  );
}

function Overview() {
  const { data } = usePoll<Stats>('/api/admin/stats', 15000);
  const cards: [string, string | number, string?][] = data
    ? [
        ['Total Users', data.users],
        ['Active Users', data.activeUsers],
        ['New Users (24h)', data.newUsers24h],
        ['Total Orders', data.orders],
        ['Trades (24h)', data.trades24h],
        ['Deposits', `${data.depositCount}`, fmtGHS(data.depositVolumeGHS)],
        ['Withdrawals', `${data.withdrawalCount}`, fmtGHS(data.withdrawalVolumeGHS)],
        ['Orbit Posts', data.posts],
        ['⚠ Pending Moderation', data.flagged],
        ['⚠ P2P Disputes', data.openDisputes],
      ]
    : [];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map(([label, value, sub]) => (
        <div key={label} className="rounded-xl border border-line bg-panel p-4">
          <div className="text-xs text-muted">{label}</div>
          <div className="num mt-1 text-2xl font-bold">{value}</div>
          {sub && <div className="num text-xs text-muted">{sub}</div>}
        </div>
      ))}
      {!data && <div className="col-span-full py-10 text-center text-muted">Loading stats…</div>}
    </div>
  );
}
