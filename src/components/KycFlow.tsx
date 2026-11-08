'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePoll, useUser } from '@/lib/hooks';
import {
  IconShield, IconIdCard, IconCamera, IconCheckCircle, IconAlertCircle, IconUpload, IconClock,
} from '@/components/icons';

type KycInfo = {
  kyc: { status: string; note: string | null; idType: string; legalName: string; updatedAt: string } | null;
  kycLevel: number;
};

const input =
  'w-full rounded-xl border border-line bg-bg px-4 py-3 text-[14px] outline-none transition focus:border-accent';

const COUNTRIES: [string, string][] = [
  ['GH', 'Ghana'], ['NG', 'Nigeria'], ['KE', 'Kenya'], ['ZA', 'South Africa'], ['US', 'United States'],
  ['GB', 'United Kingdom'], ['DE', 'Germany'], ['FR', 'France'], ['CA', 'Canada'], ['IN', 'India'],
];

export default function KycFlow() {
  const { user, loading } = useUser();
  const { data, refresh } = usePoll<KycInfo>(user ? '/api/kyc' : null, 0);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ legalName: '', dob: '', country: 'GH', address: '', idType: 'GHANA_CARD', idNumber: '' });
  const [docFront, setDocFront] = useState<File | null>(null);
  const [docBack, setDocBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (!loading && !user) {
    return (
      <div className="px-5 pt-24 text-center text-sm text-muted">
        <Link href="/m/login" className="font-semibold text-accent">Log in</Link> to verify your identity.
      </div>
    );
  }

  const status = data?.kyc?.status;
  if (!submitted && status && status !== 'INFO_REQUIRED' && status !== 'REJECTED') {
    return <StatusView info={data!} />;
  }
  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-5 pt-16 text-center">
        <span className="inline-flex rounded-full bg-up/10 p-4 text-up"><IconCheckCircle size={36} /></span>
        <h1 className="mt-4 text-[18px] font-bold">Verification submitted</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your identity verification has been submitted successfully. We will notify you when the review is complete.
        </p>
        <Link href="/m/assets" className="mt-6 inline-block w-full rounded-full bg-white py-3 text-[14px] font-bold text-black">
          Done
        </Link>
      </div>
    );
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (docFront) fd.append('docFront', docFront);
      if (docBack) fd.append('docBack', docBack);
      if (selfie) fd.append('selfie', new File([selfie], 'selfie.jpg', { type: 'image/jpeg' }));
      const res = await fetch('/api/kyc', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      setSubmitted(true);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-4">
      <div className="flex items-center gap-3">
        <Link href="/m/assets" className="text-xl text-muted">‹</Link>
        <h1 className="text-[17px] font-bold">Identity Verification</h1>
      </div>

      {(status === 'REJECTED' || status === 'INFO_REQUIRED') && data?.kyc?.note && (
        <div className="mt-3 flex gap-2.5 rounded-xl border border-down/30 bg-down/10 p-3.5 text-[13px]">
          <IconAlertCircle size={18} className="shrink-0 text-down" />
          <div>
            <span className="font-bold text-down">
              {status === 'REJECTED' ? 'Application rejected' : 'Additional information required'}
            </span>
            <p className="mt-0.5 text-foreground/90">{data.kyc.note}</p>
            <p className="mt-1 text-muted">Please resubmit with the corrections below.</p>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="mt-4 flex items-center gap-2">
        {['Personal info', 'ID document', 'Face check'].map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <div className={`h-1 rounded-full ${step > i ? 'bg-up' : 'bg-line'}`} />
            <span className={`text-[11px] font-medium ${step === i + 1 ? 'text-foreground' : 'text-muted'}`}>{s}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="mt-5 space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-muted">Full legal name (as on your ID)</span>
            <input value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="e.g. Kwame Kofi Mensah" className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-muted">Date of birth</span>
            <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-muted">Country of residence</span>
            <select value={form.country} onChange={(e) => set('country', e.target.value)} className={input}>
              {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-muted">Residential address</span>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="House number, street, city" className={input} />
          </label>
          <button
            onClick={() => {
              if (form.legalName.trim().length < 3) return setError('Enter your full legal name');
              if (!form.dob) return setError('Enter your date of birth');
              if (form.address.trim().length < 5) return setError('Enter your residential address');
              setError('');
              setStep(2);
            }}
            className="w-full rounded-full bg-white py-3 text-[14px] font-bold text-black"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-muted">Document type</span>
            <select value={form.idType} onChange={(e) => set('idType', e.target.value)} className={input}>
              <option value="GHANA_CARD">Ghana Card (recommended for Ghana)</option>
              <option value="PASSPORT">International Passport</option>
              <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-muted">
              {form.idType === 'GHANA_CARD' ? 'Ghana Card number' : 'Document number'}
            </span>
            <input
              value={form.idNumber}
              onChange={(e) => set('idNumber', e.target.value.toUpperCase())}
              placeholder={form.idType === 'GHANA_CARD' ? 'GHA-XXXXXXXXX-X' : 'Document number'}
              className={`num ${input}`}
            />
          </label>
          <DocPicker label="Front of document" file={docFront} onPick={setDocFront} />
          <DocPicker label="Back of document" file={docBack} onPick={setDocBack} />
          <button
            onClick={() => {
              if (!form.idNumber.trim()) return setError('Enter your document number');
              if (form.idType === 'GHANA_CARD' && !/^GHA-\d{9}-\d$/.test(form.idNumber)) return setError('Ghana Card number must look like GHA-123456789-0');
              if (!docFront || !docBack) return setError('Upload both sides of your document');
              setError('');
              setStep(3);
            }}
            className="w-full rounded-full bg-white py-3 text-[14px] font-bold text-black"
          >
            Continue
          </button>
          <button onClick={() => setStep(1)} className="w-full text-center text-sm text-muted">Back</button>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5">
          <SelfieCapture selfie={selfie} onCapture={setSelfie} />
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Your live photo is captured directly from your camera and compared with your ID during review by our
            compliance team. Automated biometric matching is enabled when an approved verification provider is
            configured. Your documents are stored securely and never shared.
          </p>
          <button
            onClick={submit}
            disabled={busy || !selfie}
            className="mt-4 w-full rounded-full bg-white py-3 text-[14px] font-bold text-black disabled:opacity-40"
          >
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
          <button onClick={() => setStep(2)} className="mt-2 w-full text-center text-sm text-muted">Back</button>
        </div>
      )}

      {error && <p className="mt-3 text-center text-sm font-medium text-down">{error}</p>}
    </div>
  );
}

function DocPicker({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div>
      <span className="mb-1 block text-[13px] font-medium text-muted">{label}</span>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onPick(f);
            setPreview(URL.createObjectURL(f));
          }
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-sm font-medium ${
          file ? 'border-up/50 text-up' : 'border-line text-muted'
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="max-h-28 rounded-lg object-contain" />
        ) : (
          <>
            <IconUpload size={18} /> Tap to upload a clear photo
          </>
        )}
      </button>
    </div>
  );
}

/** Live face capture using the device camera (no gallery uploads). */
function SelfieCapture({ selfie, onCapture }: { selfie: Blob | null; onCapture: (b: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (active) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user', width: 720 } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play();
          }
        })
        .catch(() => setError('Camera access is required for live face verification. Allow camera access and try again.'));
    }
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [active]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
          setPreviewUrl(URL.createObjectURL(blob));
          setActive(false);
        }
      },
      'image/jpeg',
      0.85,
    );
  }

  return (
    <div className="text-center">
      <h2 className="flex items-center justify-center gap-2 font-bold">
        <IconCamera size={18} /> Live face verification
      </h2>
      {!active && !previewUrl && (
        <button
          onClick={() => { setError(''); setActive(true); }}
          className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line py-10 text-muted"
        >
          <IconCamera size={30} />
          <span className="text-sm font-medium">Start camera</span>
        </button>
      )}
      {active && (
        <>
          <div className="mx-auto mt-4 aspect-square w-60 overflow-hidden rounded-full border-4 border-up">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          </div>
          <button onClick={capture} className="mt-4 w-full rounded-full bg-up py-3 font-bold text-[#ffffff]">
            Capture photo
          </button>
        </>
      )}
      {previewUrl && !active && (
        <>
          <div className="mx-auto mt-4 aspect-square w-40 overflow-hidden rounded-full border-4 border-up">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Selfie preview" className="h-full w-full object-cover" />
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium text-up">
            <IconCheckCircle size={16} /> Photo captured
          </div>
          <button onClick={() => { setPreviewUrl(null); setActive(true); }} className="mt-2 text-sm text-muted underline">
            Retake
          </button>
        </>
      )}
      {error && <p className="mt-3 text-sm text-down">{error}</p>}
      {selfie && null}
    </div>
  );
}

function StatusView({ info }: { info: KycInfo }) {
  const s = info.kyc!.status;
  const cfg =
    s === 'APPROVED'
      ? { icon: <IconCheckCircle size={36} />, cls: 'bg-up/10 text-up', title: 'Verification Successful', body: 'Your identity verification has been completed successfully. You now have full access to all CediX features.' }
      : { icon: <IconClock size={36} />, cls: 'bg-gold/10 text-gold', title: 'Verification Submitted', body: 'Your identity verification has been submitted for review. We will notify you when the review is complete.' };
  return (
    <div className="mx-auto max-w-md px-5 pt-16 text-center">
      <span className={`inline-flex rounded-full p-4 ${cfg.cls}`}>{cfg.icon}</span>
      <h1 className="mt-4 text-[18px] font-bold">{cfg.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{cfg.body}</p>
      <div className="mt-5 rounded-2xl bg-panel p-4 text-left text-sm">
        <div className="flex justify-between py-1"><span className="text-muted">Name</span><span className="font-semibold">{info.kyc!.legalName}</span></div>
        <div className="flex justify-between py-1"><span className="text-muted">Document</span><span>{info.kyc!.idType.replace(/_/g, ' ')}</span></div>
        <div className="flex justify-between py-1"><span className="text-muted">Status</span><span className={s === 'APPROVED' ? 'font-bold text-up' : 'font-bold text-gold'}>{s.replace(/_/g, ' ')}</span></div>
      </div>
      <Link href="/m/assets" className="mt-6 inline-block w-full rounded-full bg-white py-3 text-[14px] font-bold text-black">
        Back to Assets
      </Link>
    </div>
  );
}
