'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePoll, useUser } from '@/lib/hooks';
import { fmtGHS } from '@/lib/format';
import AdminUsers from './AdminUsers';
import AdminFinance from './AdminFinance';
import AdminContent from './AdminContent';
import AdminSettings from './AdminSettings';
import AdminKyc from './AdminKyc';
import AdminP2P from './AdminP2P';
import AdminTrading from './AdminTrading';
import AdminBanners from './AdminBanners';
import AdminPayteller from './AdminPayteller';
import AdminMessages from './AdminMessages';
import AdminWithdrawals from './AdminWithdrawals';
import AdminEmail from './AdminEmail';
import Link from 'next/link';

type Activity = { type: string; user: string; detail: string; status: string; at: string; section: string };
type Stats = {
  users: number;
  activeUsers: number;
  newUsersToday: number;
  suspendedUsers: number;
  depositVolumeGHS: number;
  withdrawalVolumeGHS: number;
  depositTodayGHS: number;
  withdrawalTodayGHS: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  failedTx: number;
  successTxToday: number;
  tradeVolumeUSD: number;
  activeOrders: number;
  completedTrades: number;
  pendingP2P: number;
  pendingKyc: number;
  messagingUsers: number;
  notifsToday: number;
  failedNotifs: number;
  activity: Activity[];
};

// ───────────────────────── Navigation model ─────────────────────────

type SectionId =
  | 'overview' | 'users' | 'kyc' | 'finance' | 'deposits' | 'withdrawals' | 'payteller' | 'p2p'
  | 'msg-dashboard' | 'msg-access' | 'msg-senders' | 'msg-templates' | 'msg-delivery' | 'msg-announce' | 'email'
  | 'orbit' | 'moderation' | 'content' | 'trading'
  | 'settings' | 'security' | 'logs' | 'audit';

const NAV: { group: string; items: { id: SectionId; label: string; icon: string }[] }[] = [
  {
    group: 'Main',
    items: [
      { id: 'overview', label: 'Dashboard Overview', icon: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z' },
      { id: 'users', label: 'Users Management', icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
      { id: 'kyc', label: 'KYC Verification', icon: 'M9 12l2 2 4-4m5.6 2A9 9 0 1112 3a9 9 0 018.6 9z' },
      { id: 'finance', label: 'Finance & Transactions', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
      { id: 'deposits', label: 'Deposits', icon: 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16' },
      { id: 'withdrawals', label: 'Withdrawals', icon: 'M12 21V9m0 0l-4 4m4-4l4 4M4 3h16' },
      { id: 'payteller', label: 'Payteller Payments', icon: 'M2 8h20M2 12h20M6 16h4m-8 4h20a1 1 0 001-1V5a1 1 0 00-1-1H2a1 1 0 00-1 1v14a1 1 0 001 1z' },
      { id: 'p2p', label: 'P2P Management', icon: 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4m14 2v2a4 4 0 01-4 4H3' },
    ],
  },
  {
    group: 'Messaging',
    items: [
      { id: 'msg-dashboard', label: 'Messages Dashboard', icon: 'M21 11.5a8.4 8.4 0 01-9 8.4 8.6 8.6 0 01-3.8-.9L3 21l2-5.2a8.4 8.4 0 1116-4.3z' },
      { id: 'msg-access', label: 'Access & Invitations', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.7 5.7L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.6a1 1 0 01.3-.7l5.9-5.9A6 6 0 1121 9z' },
      { id: 'msg-senders', label: 'Sender Management', icon: 'M12 11a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5z' },
      { id: 'msg-templates', label: 'Notification Templates', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm0 0v6h6M8 13h8M8 17h5' },
      { id: 'msg-delivery', label: 'Delivery Status', icon: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z' },
      { id: 'msg-announce', label: 'Send Announcements', icon: 'M3 11l18-7-7 18-2.5-7.5L3 11z' },
      { id: 'email', label: 'Email Broadcast', icon: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2l8 6 8-6' },
    ],
  },
  {
    group: 'Trading',
    items: [
      { id: 'orbit', label: 'Orbit Management', icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zm-9-9h18' },
      { id: 'moderation', label: 'Orbit Moderation', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
      { id: 'content', label: 'Content Management', icon: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm4 9l2.5-3 2 2.5L16 10l4 6H5l3-2z' },
      { id: 'trading', label: 'Trading & Demo Mode', icon: 'M3 3v18h18M7 14l4-4 3 3 5-6' },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 00-2-1.2L14.5 3h-5l-.4 2.5a7.6 7.6 0 00-2 1.2l-2.5-1-2 3.5 2.1 1.6a7.4 7.4 0 000 2.4L2.6 14.8l2 3.5 2.5-1a7.6 7.6 0 002 1.2l.4 2.5h5l.4-2.5a7.6 7.6 0 002-1.2l2.5 1 2-3.5-2.1-1.6c.1-.4.1-.8.1-1.2z' },
      { id: 'security', label: 'Security', icon: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-12 0V7a5 5 0 0110 0v4' },
      { id: 'logs', label: 'Activity Logs', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'audit', label: 'Audit History', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    ],
  },
];

const SECTION_TITLES: Record<SectionId, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])),
) as Record<SectionId, string>;

function NavIcon({ d, size = 17 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ───────────────────────── Page shell ─────────────────────────

export default function AdminPage() {
  const { user, loading } = useUser();
  const [section, setSection] = useState<SectionId>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { data: stats, error: probeError } = usePoll<Stats>('/api/admin/stats', 20000);

  // Require elevation: the stats probe returns 428 until unlocked
  useEffect(() => {
    if (probeError && /password|PIN/i.test(probeError)) router.replace('/admin/login');
  }, [probeError, router]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (!loading && (!user || user.role !== 'ADMIN')) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-muted">You need administrator access to view this page.</p>
        <Link href="/admin/login" className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black">Sign in</Link>
      </div>
    );
  }
  if (!stats) {
    return <div className="py-24 text-center text-sm text-muted">Checking admin session…</div>;
  }

  const go = (id: SectionId) => {
    setSection(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="pt-4">
      {/* ── Top bar ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">CediX Trading</p>
          <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
          {section !== 'overview' && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <button onClick={() => go('overview')} className="text-accent">Overview</button>
              <span>/</span>
              <span className="truncate">{SECTION_TITLES[section]}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open admin menu"
          className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-panel px-3.5 text-sm font-medium"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          Menu
        </button>
      </div>

      {/* ── Slide-in navigation drawer ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[80]">
          <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" style={{ animation: 'adm-fade .2s ease-out' }} />
          <nav
            className="absolute bottom-0 right-0 top-0 flex w-[85%] max-w-[320px] flex-col overflow-y-auto border-l border-line bg-bg pb-[env(safe-area-inset-bottom)] shadow-2xl"
            style={{ animation: 'adm-slide .25s cubic-bezier(.2,.8,.25,1)' }}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-line bg-bg px-4 py-3">
              <p className="text-sm font-bold">Admin Menu</p>
              <button onClick={() => setMenuOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-panel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 px-2.5 py-3">
              {NAV.map((group) => (
                <div key={group.group} className="mb-4">
                  <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">{group.group}</p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => go(item.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[13px] font-medium transition-colors ${
                            section === item.id ? 'bg-panel2 text-foreground' : 'text-muted hover:bg-panel hover:text-foreground'
                          }`}
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${section === item.id ? 'bg-accent/15 text-accent' : 'bg-panel text-muted'}`}>
                            <NavIcon d={item.icon} size={15} />
                          </span>
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
          <style>{'@keyframes adm-slide{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes adm-fade{from{opacity:0}to{opacity:1}}'}</style>
        </div>
      )}

      {/* ── Section content ── */}
      <div className="mt-5">
        {section === 'overview' && <Overview stats={stats} go={go} />}
        {section === 'users' && <AdminUsers />}
        {section === 'kyc' && <AdminKyc />}
        {section === 'finance' && <AdminFinance initialSub="transactions" />}
        {section === 'deposits' && <AdminFinance initialSub="deposits" />}
        {section === 'withdrawals' && <AdminWithdrawals />}
        {section === 'payteller' && <AdminPayteller />}
        {section === 'p2p' && <AdminP2P />}
        {(section === 'msg-dashboard' || section === 'msg-access') && <AdminMessages initialSub="users" />}
        {(section === 'msg-senders' || section === 'msg-announce') && <AdminMessages initialSub="senders" />}
        {section === 'msg-templates' && <AdminMessages initialSub="templates" />}
        {section === 'msg-delivery' && <AdminMessages initialSub="delivery" />}
        {section === 'email' && <AdminEmail />}
        {(section === 'orbit' || section === 'moderation') && <AdminContent />}
        {section === 'content' && <AdminBanners />}
        {section === 'trading' && <AdminTrading />}
        {(section === 'settings' || section === 'security' || section === 'logs' || section === 'audit') && <AdminSettings />}
      </div>
    </div>
  );
}

// ───────────────────────── Overview ─────────────────────────

const TONES = {
  blue: { chip: 'bg-[#3b82f6]/12 text-[#3b82f6]' },
  green: { chip: 'bg-[#16a34a]/12 text-[#16a34a]' },
  red: { chip: 'bg-[#ef4444]/12 text-[#ef4444]' },
  amber: { chip: 'bg-[#f59e0b]/14 text-[#d97706]' },
  purple: { chip: 'bg-[#8b5cf6]/12 text-[#8b5cf6]' },
  slate: { chip: 'bg-[#64748b]/12 text-[#64748b]' },
} as const;
type Tone = keyof typeof TONES;

function StatCard({ tone, icon, title, value, onClick }: { tone: Tone; icon: string; title: string; value: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-transform active:scale-[0.99]"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone].chip}`}>
        <NavIcon d={icon} size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium text-muted">{title}</span>
        <span className="num block truncate text-[16px] font-bold leading-tight">{value}</span>
      </span>
    </button>
  );
}

function Overview({ stats, go }: { stats: Stats; go: (id: SectionId) => void }) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const n = (v: number) => v.toLocaleString('en-US');
  const usd = (v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const groups: { label: string; cards: [Tone, string, string, string, SectionId][] }[] = [
    {
      label: 'Users',
      cards: [
        ['blue', 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z', 'Total Registered Users', n(stats.users), 'users'],
        ['blue', 'M9 12l2 2 4-4m5.6 2A9 9 0 1112 3a9 9 0 018.6 9z', 'Active Users', n(stats.activeUsers), 'users'],
        ['green', 'M12 5v14m-7-7h14', 'New Users Today', n(stats.newUsersToday), 'users'],
        ['red', 'M18.4 5.6L5.6 18.4M5.6 5.6l12.8 12.8', 'Suspended Accounts', n(stats.suspendedUsers), 'users'],
      ],
    },
    {
      label: 'Financial',
      cards: [
        ['green', 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16', 'Total Successful Deposits', fmtGHS(stats.depositVolumeGHS), 'deposits'],
        ['green', 'M12 21V9m0 0l-4 4m4-4l4 4M4 3h16', 'Total Successful Withdrawals', fmtGHS(stats.withdrawalVolumeGHS), 'withdrawals'],
        ['blue', 'M12 3v12m0 0l-4-4m4 4l4-4', "Today's Deposit Amount", fmtGHS(stats.depositTodayGHS), 'deposits'],
        ['blue', 'M12 21V9m0 0l-4 4m4-4l4 4', "Today's Withdrawal Amount", fmtGHS(stats.withdrawalTodayGHS), 'withdrawals'],
      ],
    },
    {
      label: 'Payments',
      cards: [
        ['amber', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'Pending Deposits', n(stats.pendingDeposits), 'payteller'],
        ['amber', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'Pending Withdrawals', n(stats.pendingWithdrawals), 'withdrawals'],
        ['red', 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4m0 4h.01', 'Failed Transactions', n(stats.failedTx), 'finance'],
        ['green', 'M20 6L9 17l-5-5', 'Successful Transactions Today', n(stats.successTxToday), 'finance'],
      ],
    },
    {
      label: 'Trading',
      cards: [
        ['purple', 'M3 3v18h18M7 14l4-4 4 4 5-6', 'Total Trading Volume', usd(stats.tradeVolumeUSD), 'finance'],
        ['purple', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'Active Trades (open orders)', n(stats.activeOrders), 'finance'],
        ['purple', 'M20 6L9 17l-5-5', 'Completed Trades', n(stats.completedTrades), 'finance'],
        ['amber', 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4m14 2v2a4 4 0 01-4 4H3', 'Pending P2P Orders', n(stats.pendingP2P), 'p2p'],
      ],
    },
    {
      label: 'System',
      cards: [
        ['amber', 'M9 12l2 2 4-4m5.6 2A9 9 0 1112 3a9 9 0 018.6 9z', 'Pending KYC Applications', n(stats.pendingKyc), 'kyc'],
        ['blue', 'M21 11.5a8.4 8.4 0 01-9 8.4 8.6 8.6 0 01-3.8-.9L3 21l2-5.2a8.4 8.4 0 1116-4.3z', 'Active Messaging Users', n(stats.messagingUsers), 'msg-access'],
        ['green', 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', 'Notifications Sent Today', n(stats.notifsToday), 'msg-delivery'],
        ['red', 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4m0 4h.01', 'Failed Notification Deliveries', n(stats.failedNotifs), 'msg-delivery'],
      ],
    },
  ];

  const statusColor = (s: string) =>
    ['COMPLETED', 'ACTIVE', 'APPROVED'].includes(s) ? 'text-up' : ['FAILED', 'CANCELLED', 'REJECTED', 'BLOCKED', 'SUSPENDED'].includes(s) ? 'text-down' : 'text-gold';

  const quick: [string, string, SectionId][] = [
    ['View Users', 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z', 'users'],
    ['Review KYC', 'M9 12l2 2 4-4m5.6 2A9 9 0 1112 3a9 9 0 018.6 9z', 'kyc'],
    ['Review Withdrawals', 'M12 21V9m0 0l-4 4m4-4l4 4M4 3h16', 'withdrawals'],
    ['View Transactions', 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', 'finance'],
    ['Send Announcement', 'M3 11l18-7-7 18-2.5-7.5L3 11z', 'msg-announce'],
    ['Manage Messages', 'M21 11.5a8.4 8.4 0 01-9 8.4 8.6 8.6 0 01-3.8-.9L3 21l2-5.2a8.4 8.4 0 1116-4.3z', 'msg-dashboard'],
  ];

  return (
    <div>
      <p className="text-sm text-muted">Welcome back, Admin. Here&apos;s what&apos;s happening on CediX Trading.</p>
      <p className="mt-0.5 text-xs text-muted">{today}</p>

      {groups.map((g) => (
        <section key={g.label} className="mt-5">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">{g.label}</h2>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {g.cards.map(([tone, icon, title, value, target]) => (
              <StatCard key={title} tone={tone} icon={icon} title={title} value={value} onClick={() => go(target)} />
            ))}
          </div>
        </section>
      ))}

      {/* Quick Actions */}
      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
          {quick.map(([label, icon, target]) => (
            <button
              key={label}
              onClick={() => go(target)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-4 text-center text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-transform active:scale-[0.98]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <NavIcon d={icon} size={16} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">Recent Platform Activity</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-panel">
          {stats.activity.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">No recorded activity yet.</p>
          ) : (
            stats.activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0">
                <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  a.type === 'Deposit' ? 'bg-[#16a34a]/12 text-[#16a34a]'
                  : a.type === 'Withdrawal' ? 'bg-[#3b82f6]/12 text-[#3b82f6]'
                  : a.type === 'KYC' ? 'bg-[#f59e0b]/14 text-[#d97706]'
                  : 'bg-[#8b5cf6]/12 text-[#8b5cf6]'
                }`}>
                  {a.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {a.user} <span className="font-normal text-muted">— {a.detail}</span>
                  </p>
                  <p className="text-[11px] text-muted">
                    {new Date(a.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    <span className={statusColor(a.status)}>{a.status.replace(/_/g, ' ')}</span>
                  </p>
                </div>
                <button onClick={() => go(a.section as SectionId)} className="shrink-0 rounded-lg bg-panel2 px-2.5 py-1.5 text-[11px] font-medium">
                  View
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
