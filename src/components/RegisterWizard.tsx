'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post } from '@/lib/hooks';
import { IconMail, IconLock, IconCheckCircle } from '@/components/icons';

const COUNTRIES: [string, string][] = [
  ['GH', 'Ghana'], ['NG', 'Nigeria'], ['KE', 'Kenya'], ['ZA', 'South Africa'], ['CI', "Côte d'Ivoire"],
  ['TG', 'Togo'], ['BF', 'Burkina Faso'], ['US', 'United States'], ['GB', 'United Kingdom'],
  ['DE', 'Germany'], ['FR', 'France'], ['CA', 'Canada'], ['IN', 'India'], ['AE', 'United Arab Emirates'],
];

const input =
  'w-full rounded-xl border border-line bg-bg px-4 py-3 text-[14px] outline-none transition focus:border-accent';

export default function RegisterWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ country: 'GH', email: '', username: '', password: '', confirm: '', terms: false });
  const [code, setCode] = useState('');
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function sendCode() {
    setError('');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) return setError('Username must be 3–20 characters (letters, numbers, underscore)');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (!form.terms) return setError('You must agree to the Terms of Service and Privacy Policy');
    setBusy(true);
    try {
      const res = await post<{ sent: boolean; sandbox?: boolean; code?: string }>('/api/auth/send-code', { email: form.email });
      setSandboxCode(res.sandbox ? res.code ?? null : null);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send code');
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    setError('');
    setBusy(true);
    try {
      await post('/api/auth/register', {
        email: form.email,
        username: form.username,
        password: form.password,
        country: form.country,
        code,
      });
      setStep(3);
      setTimeout(() => (window.location.href = '/'), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md px-4 pb-16">
      <div className="rounded-2xl border border-line bg-panel p-7">
        {/* Progress */}
        <div className="mb-6 flex items-center gap-2">
          {['Account', 'Verify email', 'Done'].map((s, i) => (
            <div key={s} className="flex flex-1 flex-col gap-1.5">
              <div className={`h-1 rounded-full ${step > i ? 'bg-up' : 'bg-line'}`} />
              <span className={`text-[11px] font-medium ${step === i + 1 ? 'text-foreground' : 'text-muted'}`}>{s}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="text-[17px] font-bold">Create your account</h1>
            <p className="mt-1 text-sm text-muted">Join CediX and start trading in minutes.</p>
            <div className="mt-5 space-y-3.5">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-muted">Country / Region</span>
                <select value={form.country} onChange={(e) => set('country', e.target.value)} className={input}>
                  {COUNTRIES.map(([c, n]) => (
                    <option key={c} value={c}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-muted">Email address</span>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" className={input} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-muted">Username</span>
                <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="Choose a username" className={input} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-muted">Password</span>
                <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" className={input} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-muted">Confirm password</span>
                <input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} placeholder="Re-enter password" autoComplete="new-password" className={input} />
              </label>
              <label className="flex items-start gap-2.5 pt-1 text-[13px] text-muted">
                <input type="checkbox" checked={form.terms} onChange={(e) => set('terms', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0B4F3F]" />
                <span>
                  I agree to the CediX <span className="font-semibold text-foreground">Terms of Service</span> and{' '}
                  <span className="font-semibold text-foreground">Privacy Policy</span>.
                </span>
              </label>
            </div>
            {error && <p className="mt-3 text-sm text-down">{error}</p>}
            <button
              onClick={sendCode}
              disabled={busy || !form.email || !form.username || !form.password}
              className="mt-5 w-full rounded-full bg-white py-3 text-[14px] font-bold text-black transition active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? 'Sending code…' : 'Continue'}
            </button>
            <p className="mt-4 text-center text-sm text-muted">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-accent">Log in</Link>
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <span className="inline-flex rounded-full bg-panel2 p-3 text-foreground"><IconMail size={22} /></span>
            <h1 className="mt-3 text-[17px] font-bold">Verify your email</h1>
            <p className="mt-1 text-sm text-muted">
              Enter the 6-digit code sent to <span className="font-semibold text-foreground">{form.email}</span>.
            </p>
            {sandboxCode && (
              <div className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-[13px]">
                <span className="font-bold text-gold">Sandbox mode:</span> email delivery is not configured on this
                server, so your code is <span className="num font-bold">{sandboxCode}</span>.
              </div>
            )}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="______"
              inputMode="numeric"
              className="num mt-5 w-full rounded-xl border border-line bg-bg px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-accent"
            />
            {error && <p className="mt-3 text-sm text-down">{error}</p>}
            <button
              onClick={createAccount}
              disabled={busy || code.length !== 6}
              className="mt-5 w-full rounded-full bg-white py-3 text-[14px] font-bold text-black disabled:opacity-40"
            >
              {busy ? 'Creating account…' : 'Verify & create account'}
            </button>
            <button onClick={() => { setStep(1); setCode(''); }} className="mt-3 w-full text-center text-sm text-muted">
              Back
            </button>
          </>
        )}

        {step === 3 && (
          <div className="py-8 text-center">
            <span className="inline-flex rounded-full bg-up/10 p-4 text-up"><IconCheckCircle size={36} /></span>
            <h1 className="mt-4 text-[17px] font-bold">Account created</h1>
            <p className="mt-1 text-sm text-muted">Welcome to CediX — taking you to your dashboard…</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-muted">
        <IconLock size={13} /> Your data is encrypted and protected.
      </div>
    </div>
  );
}
