import { useState } from 'react';

import { isAuthenticated } from '../api/auth';
import { AccountHeader } from '../components/account/AccountHeader';
import { AccountNav, AccountNavMobile } from '../components/account/AccountNav';
import { AiSettingsSection } from '../components/account/AiSettingsSection';
import { DataSection } from '../components/account/DataSection';
import { HomeSection } from '../components/account/HomeSection';
import { PersonalSection } from '../components/account/PersonalSection';
import { ProfileSection } from '../components/account/ProfileSection';
import { SecuritySection } from '../components/account/SecuritySection';
import { SignedOutCard } from '../components/account/SignedOutCard';
import { StatusBanner } from '../components/account/StatusBanner';
import { cardCls } from '../components/account/styles';
import type { Section } from '../components/account/types';
import { useAccountData } from '../hooks/useAccountData';

/**
 * Google-Account-style manager for the user's Praxly account (Keycloak or
 * Google — whichever they signed in with): personal info (email/name),
 * security (password), AI settings, and data & activity (usage stats + chat
 * history management).
 *
 * This page is only the shell — nav, status banner, and section switch. Every
 * pane lives in `components/account/` and owns its own form state.
 */
export default function AccountPage() {
  const [section, setSection] = useState<Section>('home');
  const { profile, setProfile, usage, chats, setChats, loading, status, notify, dismissStatus } =
    useAccountData();

  if (!isAuthenticated()) {
    return <SignedOutCard />;
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 font-sans">
      <AccountHeader profile={profile} />

      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6 sm:px-6">
        <AccountNav section={section} onSelect={setSection} />

        <main className="min-w-0 flex-1">
          <AccountNavMobile section={section} onSelect={setSection} />

          <StatusBanner status={status} onDismiss={dismissStatus} />

          {loading ? (
            <div className={`${cardCls} p-10 text-center text-sm text-slate-500`}>Loading…</div>
          ) : section === 'home' ? (
            <HomeSection profile={profile} usage={usage} onNavigate={setSection} />
          ) : section === 'personal' ? (
            <PersonalSection profile={profile} setProfile={setProfile} notify={notify} />
          ) : section === 'security' ? (
            <SecuritySection profile={profile} notify={notify} />
          ) : section === 'ai' ? (
            <AiSettingsSection notify={notify} />
          ) : section === 'profile' ? (
            <ProfileSection />
          ) : (
            <DataSection usage={usage} chats={chats} setChats={setChats} notify={notify} />
          )}
        </main>
      </div>
    </div>
  );
}
