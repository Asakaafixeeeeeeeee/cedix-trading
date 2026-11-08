import Navbar from '@/components/Navbar';

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-16">{children}</main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        CediX © 2026 — Crypto trading for Ghana. Payments powered by Payteller.
      </footer>
    </>
  );
}
