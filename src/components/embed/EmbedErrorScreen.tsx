import { AlertCircle } from 'lucide-react';

/** Shown instead of the player when the link carries no decodable program. */
export function EmbedErrorScreen({ message }: { message: string | null }) {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-100">
      <div className="text-center space-y-4">
        <AlertCircle size={48} className="mx-auto text-red-500 opacity-50" />
        <div>
          <h2 className="text-xl font-bold text-red-400 mb-2">{message || 'No Code Found'}</h2>
          <p className="text-slate-400">The embed data could not be loaded.</p>
        </div>
      </div>
    </div>
  );
}
