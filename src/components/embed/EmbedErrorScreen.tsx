import { AlertCircle } from 'lucide-react';

/** Shown instead of the player when the link carries no decodable program. */
export function EmbedErrorScreen({ message }: { message: string | null }) {
  return (
    /* <main> + h1: this screen replaces the whole embed, so it carries the
       page's only landmark and heading. */
    <main className="flex items-center justify-center h-screen bg-slate-950 text-slate-100">
      <div className="text-center space-y-4">
        <AlertCircle size={48} className="mx-auto text-red-500 opacity-50" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-red-400 mb-2">{message || 'No Code Found'}</h1>
          <p className="text-slate-400">The embed data could not be loaded.</p>
        </div>
      </div>
    </main>
  );
}
