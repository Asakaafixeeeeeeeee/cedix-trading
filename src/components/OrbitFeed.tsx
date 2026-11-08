'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { post as apiPost, usePoll, useUser } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';
import { IconImage, IconVideo, IconHeart, IconComment } from '@/components/icons';

type Post = {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  mediaType: string | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null; kycLevel: number };
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: { username: string; displayName: string | null; avatarUrl: string | null };
};

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function OrbitFeed() {
  const { user } = useUser();
  const { data, refresh } = usePoll<{ posts: Post[]; myId: string | null }>('/api/orbit/posts', 15000);

  return (
    <div className="mx-auto max-w-2xl">
      {user && !user.orbitBanned && <Composer onPosted={refresh} />}
      {user?.orbitBanned && (
        <div className="mb-4 rounded-xl border border-down/40 bg-down/10 p-4 text-sm text-down">
          Your account has been blocked from posting in Orbit by our fraud-prevention system.
        </div>
      )}
      {!user && (
        <div className="mb-4 rounded-xl border border-line bg-panel p-4 text-center text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">Log in</Link> to join the conversation.
        </div>
      )}
      <div className="space-y-4">
        {(data?.posts ?? []).map((p) => (
          <PostCard key={p.id} post={p} myId={data?.myId ?? null} isAdmin={user?.role === 'ADMIN'} onChange={refresh} />
        ))}
        {(data?.posts ?? []).length === 0 && (
          <div className="py-16 text-center text-muted">No posts yet — be the first to share your market view!</div>
        )}
      </div>
    </div>
  );
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<{ url: string; mediaType: string }[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMsg(null);
    try {
      for (const file of Array.from(files).slice(0, 4 - media.length)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/orbit/upload', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setMedia((m) => [...m, json]);
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiPost<{ flagged?: boolean; message?: string }>('/api/orbit/posts', {
        content,
        mediaUrls: media.map((m) => m.url),
        mediaType: media.some((m) => m.mediaType === 'video') ? 'video' : media.length ? 'image' : null,
      });
      setContent('');
      setMedia([]);
      if (res.flagged) {
        setMsg({ ok: true, text: res.message ?? 'Post under review.' });
      } else {
        onPosted();
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Post failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-line bg-panel p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Share your market analysis, charts or trading ideas…"
        className="w-full resize-none rounded-lg border border-line bg-bg p-3 text-sm outline-none focus:border-accent"
      />
      {media.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {media.map((m, i) => (
            <div key={i} className="relative">
              {m.mediaType === 'video' ? (
                <video src={m.url} className="h-20 rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="upload" className="h-20 rounded-lg object-cover" />
              )}
              <button
                onClick={() => setMedia((x) => x.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-down text-[10px] text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? 'text-gold' : 'text-down'}`}>{msg.text}</p>}
      <div className="mt-3 flex items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={(e) => upload(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading || media.length >= 4} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-white disabled:opacity-40">
          {uploading ? 'Uploading…' : (<span className="flex items-center gap-1.5"><IconImage size={15} /> Photo <IconVideo size={15} /> Video</span>)}
        </button>
        <span className="text-[11px] text-muted">AI moderation active — fraud is auto-removed</span>
        <button
          onClick={submit}
          disabled={busy || (!content.trim() && media.length === 0)}
          className="ml-auto rounded-lg bg-white px-5 py-1.5 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}

function PostCard({ post, myId, isAdmin, onChange }: { post: Post; myId: string | null; isAdmin?: boolean; onChange: () => void }) {
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);

  async function toggleLike() {
    if (!myId) return;
    const res = await apiPost<{ liked: boolean }>(`/api/orbit/posts/${post.id}/like`);
    setLiked(res.liked);
    setLikeCount((c) => c + (res.liked ? 1 : -1));
  }

  async function remove() {
    if (!confirm('Delete this post?')) return;
    await apiPost(`/api/orbit/posts/${post.id}`, undefined, 'DELETE');
    onChange();
  }

  const media = (post.mediaUrls as string[] | null) ?? [];

  return (
    <article className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center gap-3">
        <Avatar name={post.author.displayName || post.author.username} />
        <div>
          <div className="text-sm font-semibold">
            {post.author.displayName || post.author.username}
            {post.author.kycLevel >= 2 && <span className="ml-1 text-xs text-accent" title="Verified">✓</span>}
          </div>
          <div className="text-xs text-muted">@{post.author.username} · {timeAgo(post.createdAt)}</div>
        </div>
        {(myId === post.author.id || isAdmin) && (
          <button onClick={remove} className="ml-auto text-xs text-muted hover:text-down">Delete</button>
        )}
      </div>
      {post.content && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>}
      {media.length > 0 && (
        <div className={`mt-3 grid gap-2 ${media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {media.map((url, i) =>
            post.mediaType === 'video' ? (
              <video key={i} src={url} controls className="max-h-96 w-full rounded-lg bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="max-h-96 w-full rounded-lg object-cover" />
            ),
          )}
        </div>
      )}
      <div className="mt-3 flex items-center gap-5 text-sm text-muted">
        <button onClick={toggleLike} className={`flex items-center gap-1.5 hover:text-white ${liked ? 'text-down' : ''}`}>
          <IconHeart size={17} filled={liked} className={liked ? 'text-down' : ''} /> {likeCount}
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="flex items-center gap-1.5 hover:text-white">
          <IconComment size={17} /> {post.commentCount}
        </button>
      </div>
      {showComments && <Comments postId={post.id} canComment={!!myId} />}
    </article>
  );
}

function Comments({ postId, canComment }: { postId: string; canComment: boolean }) {
  const { data, refresh } = usePoll<{ comments: Comment[] }>(`/api/orbit/posts/${postId}/comments`, 0);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await apiPost(`/api/orbit/posts/${postId}/comments`, { content: text });
      setText('');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {(data?.comments ?? []).map((c) => (
        <div key={c.id} className="mb-2 flex gap-2 text-sm">
          <span className="font-semibold">{c.author.displayName || c.author.username}</span>
          <span className="min-w-0 break-words text-foreground/90">{c.content}</span>
          <span className="ml-auto shrink-0 text-xs text-muted">{timeAgo(c.createdAt)}</span>
        </div>
      ))}
      {canComment && (
        <div className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && text.trim() && submit()}
            placeholder="Add a comment…"
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button onClick={submit} disabled={busy || !text.trim()} className="rounded-lg bg-panel2 px-4 text-sm font-medium disabled:opacity-40">
            Reply
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-down">{error}</p>}
    </div>
  );
}
