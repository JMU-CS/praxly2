/**
 * Reads the program an embed link carries. Two link formats are supported:
 *
 *   v2  ?code=<lz-compressed-json>       — current `encodeEmbed` output
 *   v1  #code=<url-encoded-praxis>       — legacy links still in the wild
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { decodeEmbed, type EmbedData } from '../utils/embedCodec';

export function useEmbedData() {
  const [searchParams] = useSearchParams();
  const [embedData, setEmbedData] = useState<EmbedData | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      const decoded = decodeEmbed(code);
      if (!decoded) {
        setDecodeError('Failed to decode embed data');
        return;
      }
      setEmbedData(decoded);
      return;
    }

    const hash = window.location.hash;
    if (hash.startsWith('#code=')) {
      const v1Code = decodeURIComponent(hash.slice('#code='.length));
      setEmbedData({ code: v1Code, lang: 'praxis' });
      return;
    }

    setDecodeError('No code provided in URL');
  }, [searchParams]);

  /** Lets the user edit the embedded source in place. */
  const setCode = (code: string) => setEmbedData((prev) => (prev ? { ...prev, code } : null));

  return { embedData, decodeError, setCode };
}
