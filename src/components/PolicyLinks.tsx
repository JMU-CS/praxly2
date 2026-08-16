/**
 * Links to the hosted privacy policy and terms of service.
 *
 * Both are static files in `public/`, not react-router routes, so these are
 * plain anchors resolved against the Vite base rather than `<Link>`s. They open
 * in a new tab because every place they appear is somewhere the user is partway
 * through something — a consent prompt, a sign-in, an open settings menu — and
 * navigating the tab away would drop it.
 */
export function PolicyLinks({ className = '' }: { className?: string }) {
  const base = import.meta.env.BASE_URL;

  return (
    <p className={`text-xs text-muted ${className}`}>
      <a href={`${base}privacy.html`} target="_blank" rel="noopener noreferrer" className={linkCls}>
        Privacy Policy
      </a>
      <span aria-hidden="true"> · </span>
      <a href={`${base}terms.html`} target="_blank" rel="noopener noreferrer" className={linkCls}>
        Terms of Service
      </a>
    </p>
  );
}

const linkCls =
  'underline underline-offset-2 hover:text-slate-200 transition-colors rounded-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ' +
  'focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900';
