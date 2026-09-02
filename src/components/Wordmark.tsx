import { BRAND } from '@/lib/brand';

/** The logo lockup: the same three ascending bars as the app icon, plus the
 *  name. Inline SVG so it inherits theme colours and needs no image request. */
export default function Wordmark({ small = false }: { small?: boolean }) {
  const size = small ? 20 : 26;
  return (
    <span className="wordmark" style={{ fontSize: small ? 15 : 19 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
        <rect x="3" y="13" width="4.6" height="8" rx="1.4" fill="var(--pie-spends)" />
        <rect x="9.7" y="8" width="4.6" height="13" rx="1.4" fill="var(--pie-spends)" />
        <rect x="16.4" y="3" width="4.6" height="18" rx="1.4" fill="var(--pie-deposits)" />
      </svg>
      <span>{BRAND.name}</span>
    </span>
  );
}
