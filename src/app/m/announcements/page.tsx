'use client';
import Link from 'next/link';
import { usePoll } from '@/lib/hooks';

type Announcement = { id: string; title: string; body: string | null; pinned: boolean; publishAt: string };

export default function MobileAnnouncements() {
  const { data } = usePoll<{ announcements: Announcement[] }>('/api/announcements?limit=50', 0);

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-3 py-2">
        <Link href="/m" className="text-xl text-muted">‹</Link>
        <h1 className="text-[17px] font-bold">Announcements</h1>
      </div>
      <div className="mt-1">
        {(data?.announcements ?? []).map((a) => (
          <article key={a.id} className="border-b border-line/60 py-3.5 last:border-0">
            <div className="flex items-start gap-2">
              {a.pinned && (
                <span className="mt-0.5 rounded bg-gold/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-gold">Pinned</span>
              )}
              <h2 className="text-[14px] font-semibold leading-snug">{a.title}</h2>
            </div>
            {a.body && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{a.body}</p>}
            <div className="num mt-1.5 text-[11.5px] text-muted">
              {new Date(a.publishAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })},{' '}
              {new Date(a.publishAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          </article>
        ))}
        {data && (data.announcements ?? []).length === 0 && (
          <div className="py-14 text-center text-[13px] text-muted">No announcements yet.</div>
        )}
      </div>
    </div>
  );
}
