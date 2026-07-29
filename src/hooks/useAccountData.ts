import { useCallback, useEffect, useState } from 'react';

import { isAuthenticated } from '../api/auth';
import { getAccount, getUsage, type AccountProfile, type AccountUsage } from '../api/account';
import { listChats, type SessionMeta } from '../api/chat';
import type { Status } from '../components/account/StatusBanner';

/**
 * Loads everything the account manager shows (profile, usage, chat list) in one
 * pass, and owns the status banner the sections write to. The three fetches are
 * settled independently so one failing backend route doesn't blank the page.
 */
export function useAccountData() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [chats, setChats] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>(null);

  const notify = useCallback((kind: 'success' | 'error', text: string) => {
    setStatus({ kind, text });
  }, []);

  const dismissStatus = useCallback(() => setStatus(null), []);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    Promise.allSettled([getAccount(), getUsage(), listChats()]).then(
      ([profileRes, usageRes, chatsRes]) => {
        if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
        if (usageRes.status === 'fulfilled') setUsage(usageRes.value);
        if (chatsRes.status === 'fulfilled') setChats(chatsRes.value);
        setLoading(false);
      }
    );
  }, []);

  return {
    profile,
    setProfile,
    usage,
    chats,
    setChats,
    loading,
    status,
    notify,
    dismissStatus,
  };
}
