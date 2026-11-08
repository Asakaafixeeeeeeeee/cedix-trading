/**
 * CediX loading screen: pure white background with the five-square logo
 * rotating smoothly in the exact center (per design reference). Used by every
 * route segment via loading.tsx boundaries — no text, no percentages.
 */
export default function CedixLoader() {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#ffffff]">
      <svg
        width="56"
        height="56"
        viewBox="0 0 512 512"
        style={{ animation: 'cedix-spin 1.6s linear infinite' }}
        aria-label="Loading"
      >
        <g fill="#0a0a0a">
          <rect x="97" y="97" width="106" height="106" rx="10" />
          <rect x="309" y="97" width="106" height="106" rx="10" />
          <rect x="203" y="203" width="106" height="106" rx="10" />
          <rect x="97" y="309" width="106" height="106" rx="10" />
          <rect x="309" y="309" width="106" height="106" rx="10" />
        </g>
      </svg>
      <style>{'@keyframes cedix-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
