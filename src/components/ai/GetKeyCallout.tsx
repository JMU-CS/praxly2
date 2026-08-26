import { ExternalLink } from 'lucide-react';

/**
 * The "get a key at …" link, called out as a highlight.
 *
 * Shown under the API-key field in both the AI panel's onboarding gate and the
 * account page's AI section, which is why it lives here rather than being
 * written twice. Deliberately the one warm-colored thing in an indigo-on-slate
 * UI: as fine print it was missed, and an indigo callout read as more of the
 * same chrome — without a key there is nothing to type in the field above, so
 * this is the actual next step.
 */
export function GetKeyCallout({ host }: { host: string }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-md bg-yellow-200 px-2.5 py-2 text-xs font-medium text-slate-900">
      <ExternalLink size={14} className="mt-px shrink-0 text-slate-700" />
      <span>
        Get a key at{' '}
        <a
          href={`https://${host}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-indigo-900 underline underline-offset-2 hover:text-indigo-700"
        >
          {host}
        </a>
      </span>
    </p>
  );
}
