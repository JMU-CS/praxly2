import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import keycloak from '../api/keycloak';
import {
  getAccount,
  getUsage,
  updateProfile,
  changePassword,
  type AccountProfile,
  type AccountUsage,
} from '../api/account';
import { listChats, deleteChatApi, renameChatApi, type SessionMeta } from '../api/chat';
import { useByokStore, useChatStore, type ByokProvider } from '../store/appStore';

/**
 * Google-Account-style manager for the user's Keycloak account:
 * personal info (email/name), security (password), and data & activity
 * (usage stats + chat history management).
 */

type Section = 'home' | 'personal' | 'security' | 'ai' | 'data';

const NAV: Array<{ id: Section; label: string; icon: typeof User }> = [
  { id: 'home', label: 'Home', icon: User },
  { id: 'personal', label: 'Personal info', icon: Pencil },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'ai', label: 'AI model & API key', icon: KeyRound },
  { id: 'data', label: 'Data & activity', icon: MessageSquare },
];

const cardCls = 'rounded-2xl border border-slate-800 bg-slate-900';
const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition';
const primaryBtnCls =
  'rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const textBtnCls =
  'rounded-full px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-slate-800 transition-colors';

function displayName(profile: AccountProfile | null): string {
  if (!profile) return '';
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return full || profile.username;
}

function initialOf(profile: AccountProfile | null): string {
  const name = displayName(profile) || profile?.email || '?';
  return name.charAt(0).toUpperCase();
}

function Avatar({ profile, size }: { profile: AccountProfile | null; size: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-20 w-20 text-3xl' : 'h-9 w-9 text-sm';
  return (
    <div
      aria-hidden="true"
      className={`${cls} flex items-center justify-center rounded-full bg-indigo-600 font-semibold text-white select-none`}
    >
      {initialOf(profile)}
    </div>
  );
}

function StatusBanner({
  status,
  onDismiss,
}: {
  status: { kind: 'success' | 'error'; text: string } | null;
  onDismiss: () => void;
}) {
  if (!status) return null;
  return (
    <div
      role="status"
      className={`mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
        status.kind === 'success'
          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40'
          : 'bg-red-500/10 text-red-300 border border-red-500/40'
      }`}
    >
      <span className="flex items-center gap-2">
        {status.kind === 'success' ? <Check size={16} /> : <X size={16} />}
        {status.text}
      </span>
      <button onClick={onDismiss} className="p-1 opacity-60 hover:opacity-100" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export default function AccountPage() {
  const [section, setSection] = useState<Section>('home');
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [chats, setChats] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const notify = useCallback((kind: 'success' | 'error', text: string) => {
    setStatus({ kind, text });
  }, []);

  useEffect(() => {
    if (!keycloak.authenticated) {
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

  if (!keycloak.authenticated) {
    return (
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-6">
        <div className={`${cardCls} max-w-sm w-full p-8 text-center`}>
          <h1 className="text-xl font-semibold text-slate-100">Praxly Account</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to manage your account.</p>
          <button onClick={() => keycloak.login()} className={`${primaryBtnCls} mt-6 w-full`}>
            Sign in
          </button>
          <Link to="/v2/editor" className={`${textBtnCls} mt-2 inline-block`}>
            Back to editor
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            to="/v2/editor"
            className="flex items-center gap-2 rounded-full p-2 text-slate-400 hover:bg-slate-800 transition-colors"
            aria-label="Back to editor"
            title="Back to editor"
          >
            <ArrowLeft size={18} />
          </Link>
          <img src="/v2/fallen-leaf_1f342.ico" alt="" className="h-6 w-6" aria-hidden="true" />
          <span className="text-lg text-slate-300">
            Praxly <span className="font-medium text-slate-500">Account</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => keycloak.logout({ redirectUri: window.location.origin + '/v2/editor' })}
            className="flex items-center gap-2 rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
          <Avatar profile={profile} size="sm" />
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6 sm:px-6">
        {/* Left nav */}
        <nav className="hidden w-52 shrink-0 md:block" aria-label="Account sections">
          <ul className="space-y-1">
            {NAV.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => setSection(id)}
                  aria-current={section === id ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors ${
                    section === id
                      ? 'bg-indigo-500/10 font-medium text-indigo-300'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <main className="min-w-0 flex-1">
          {/* Mobile section switcher */}
          <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {NAV.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${
                  section === id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <StatusBanner status={status} onDismiss={() => setStatus(null)} />

          {loading ? (
            <div className={`${cardCls} p-10 text-center text-sm text-slate-500`}>Loading…</div>
          ) : section === 'home' ? (
            <HomeSection profile={profile} usage={usage} onNavigate={setSection} />
          ) : section === 'personal' ? (
            <PersonalSection profile={profile} setProfile={setProfile} notify={notify} />
          ) : section === 'security' ? (
            <SecuritySection notify={notify} />
          ) : section === 'ai' ? (
            <AiSettingsSection notify={notify} />
          ) : (
            <DataSection usage={usage} chats={chats} setChats={setChats} notify={notify} />
          )}
        </main>
      </div>
    </div>
  );
}

// ── Home ─────────────────────────────────────────────────────────────────────

function HomeSection({
  profile,
  usage,
  onNavigate,
}: {
  profile: AccountProfile | null;
  usage: AccountUsage | null;
  onNavigate: (s: Section) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6 text-center">
        <Avatar profile={profile} size="lg" />
        <h1 className="mt-4 text-2xl text-slate-100">
          Welcome, {displayName(profile) || 'student'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your info, security, and chat activity to make Praxly work better for you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => onNavigate('personal')}
          className={`${cardCls} p-5 text-left hover:border-slate-600 transition-colors`}
        >
          <div className="flex items-center gap-2 text-slate-100 font-medium">
            <Pencil size={16} className="text-indigo-400" /> Personal info
          </div>
          <p className="mt-2 text-sm text-slate-400 break-all">
            {profile?.email ?? 'No email set'} · @{profile?.username}
          </p>
        </button>
        <button
          onClick={() => onNavigate('security')}
          className={`${cardCls} p-5 text-left hover:border-slate-600 transition-colors`}
        >
          <div className="flex items-center gap-2 text-slate-100 font-medium">
            <KeyRound size={16} className="text-indigo-400" /> Security
          </div>
          <p className="mt-2 text-sm text-slate-400">Change the password you use to sign in.</p>
        </button>
        <button
          onClick={() => onNavigate('data')}
          className={`${cardCls} p-5 text-left hover:border-slate-600 transition-colors sm:col-span-2`}
        >
          <div className="flex items-center gap-2 text-slate-100 font-medium">
            <MessageSquare size={16} className="text-indigo-400" /> Data &amp; activity
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {usage
              ? `${usage.sessions} chats · ${usage.messages} messages · last active ${
                  usage.lastActivity ? new Date(usage.lastActivity).toLocaleDateString() : 'never'
                }`
              : 'Review your AI usage and manage chat history.'}
          </p>
        </button>
      </div>
    </div>
  );
}

// ── Personal info ────────────────────────────────────────────────────────────

function PersonalSection({
  profile,
  setProfile,
  notify,
}: {
  profile: AccountProfile | null;
  setProfile: (p: AccountProfile) => void;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const [email, setEmail] = useState(profile?.email ?? '');
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [saving, setSaving] = useState(false);

  const dirty =
    email !== (profile?.email ?? '') ||
    firstName !== (profile?.firstName ?? '') ||
    lastName !== (profile?.lastName ?? '');

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile({ email, firstName, lastName });
      setProfile({ ...profile, email, firstName, lastName });
      notify('success', 'Profile updated. Changes to your email apply the next time you sign in.');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">Personal info</h2>
        <p className="mt-1 text-sm text-slate-400">
          The email and name attached to your school account.
        </p>
      </div>
      <div className="space-y-4 p-6">
        <div>
          <label htmlFor="acct-username" className="mb-1 block text-xs font-medium text-slate-500">
            Username
          </label>
          <input
            id="acct-username"
            value={profile?.username ?? ''}
            disabled
            className={`${inputCls} text-slate-500 opacity-70`}
          />
        </div>
        <div>
          <label htmlFor="acct-email" className="mb-1 block text-xs font-medium text-slate-500">
            Email
          </label>
          <input
            id="acct-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@example.com"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="acct-first" className="mb-1 block text-xs font-medium text-slate-500">
              First name
            </label>
            <input
              id="acct-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="acct-last" className="mb-1 block text-xs font-medium text-slate-500">
              Last name
            </label>
            <input
              id="acct-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div className="pt-2">
          <button onClick={handleSave} disabled={!dirty || saving} className={primaryBtnCls}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Security ─────────────────────────────────────────────────────────────────

function SecuritySection({
  notify,
}: {
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !saving;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      notify('success', 'Password changed.');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">Security</h2>
        <p className="mt-1 text-sm text-slate-400">
          Change the password for your school account. It must be at least 8 characters.
        </p>
      </div>
      <div className="space-y-4 p-6 max-w-md">
        <div>
          <label htmlFor="pw-current" className="mb-1 block text-xs font-medium text-slate-500">
            Current password
          </label>
          <input
            id="pw-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputCls}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label htmlFor="pw-new" className="mb-1 block text-xs font-medium text-slate-500">
            New password
          </label>
          <input
            id="pw-new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="mb-1 block text-xs font-medium text-slate-500">
            Confirm new password
          </label>
          <input
            id="pw-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
          {confirm.length > 0 && next !== confirm && (
            <p className="mt-1 text-xs text-red-400">Passwords don't match.</p>
          )}
        </div>
        <div className="pt-2">
          <button onClick={handleSubmit} disabled={!canSubmit} className={primaryBtnCls}>
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI model & API key ───────────────────────────────────────────────────────

const PROVIDER_OPTIONS: Array<{ value: ByokProvider | ''; label: string; hint?: string }> = [
  { value: '', label: 'School-provided model (default)' },
  { value: 'gemini', label: 'Gemini', hint: 'aistudio.google.com/apikey' },
  { value: 'anthropic', label: 'Claude', hint: 'console.anthropic.com' },
  { value: 'openai', label: 'ChatGPT', hint: 'platform.openai.com/api-keys' },
];

function AiSettingsSection({
  notify,
}: {
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const { provider, apiKey, model, setByok, clearByok } = useByokStore();

  const [draftProvider, setDraftProvider] = useState<ByokProvider | ''>(provider ?? '');
  const [draftKey, setDraftKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(model);
  const [showKey, setShowKey] = useState(false);

  const needsKey = draftProvider !== '';
  const canSave = !needsKey || draftKey.trim().length > 0;
  const hint = PROVIDER_OPTIONS.find((o) => o.value === draftProvider)?.hint;

  const handleSave = () => {
    if (!canSave) return;
    if (draftProvider === '') {
      clearByok();
      notify('success', 'Using the school-provided model.');
    } else {
      setByok({ provider: draftProvider, apiKey: draftKey.trim(), model: draftModel.trim() });
      notify('success', 'API key saved.');
    }
  };

  return (
    <div className={`${cardCls} divide-y divide-slate-800`}>
      <div className="p-6">
        <h2 className="text-lg text-slate-100">AI model &amp; API key</h2>
        <p className="mt-1 text-sm text-slate-400">
          The AI Assistant runs on the school-provided model by default. If you have your own API
          key you can use it instead — it stays in this browser and is only used to make your
          requests.
        </p>
      </div>
      <div className="space-y-4 p-6 max-w-md">
        <div>
          <label htmlFor="byok-provider" className="mb-1 block text-xs font-medium text-slate-500">
            Provider
          </label>
          <select
            id="byok-provider"
            value={draftProvider}
            onChange={(e) => setDraftProvider(e.target.value as ByokProvider | '')}
            className={inputCls}
          >
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {needsKey && (
          <>
            <div>
              <label htmlFor="byok-key" className="mb-1 block text-xs font-medium text-slate-500">
                API key
              </label>
              <div className="relative">
                <input
                  id="byok-key"
                  type={showKey ? 'text' : 'password'}
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  placeholder="Paste your API key"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {hint && <p className="mt-1 text-xs text-slate-500">Get a key at {hint}</p>}
            </div>

            <div>
              <label htmlFor="byok-model" className="mb-1 block text-xs font-medium text-slate-500">
                Model <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="byok-model"
                type="text"
                value={draftModel}
                onChange={(e) => setDraftModel(e.target.value)}
                placeholder="Leave blank for the recommended model"
                autoComplete="off"
                spellCheck={false}
                className={inputCls}
              />
            </div>
          </>
        )}

        <div className="pt-2">
          <button onClick={handleSave} disabled={!canSave} className={primaryBtnCls}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Data & activity ──────────────────────────────────────────────────────────

function DataSection({
  usage,
  chats,
  setChats,
  notify,
}: {
  usage: AccountUsage | null;
  chats: SessionMeta[];
  setChats: (c: SessionMeta[]) => void;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const removeSession = useChatStore((s) => s.removeSession);
  const updateSession = useChatStore((s) => s.updateSession);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Fill the last 30 days so quiet days render as empty bars, not gaps.
  const bars = useMemo(() => {
    const byDay = new Map((usage?.daily ?? []).map((d) => [d.day, d.count]));
    const days: Array<{ day: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ day: key, count: byDay.get(key) ?? 0 });
    }
    return days;
  }, [usage]);
  const maxCount = Math.max(1, ...bars.map((b) => b.count));

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    try {
      await deleteChatApi(id);
      removeSession(id);
      setChats(chats.filter((c) => c.id !== id));
      notify('success', 'Chat deleted.');
    } catch {
      notify('error', 'Failed to delete chat.');
    }
  };

  const handleRename = async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    try {
      await renameChatApi(id, title);
      updateSession(id, { title });
      setChats(chats.map((c) => (c.id === id ? { ...c, title } : c)));
    } catch {
      notify('error', 'Failed to rename chat.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Usage */}
      <div className={`${cardCls} p-6`}>
        <h2 className="text-lg text-slate-100">AI usage</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Chats', value: usage?.sessions ?? 0 },
            { label: 'Messages', value: usage?.messages ?? 0 },
            { label: 'Sent', value: usage?.sent ?? 0 },
            { label: 'Received', value: usage?.received ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-slate-800/50 p-4 text-center">
              <div className="text-2xl font-medium text-slate-100">{stat.value}</div>
              <div className="mt-1 text-xs text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
          Last 30 days
        </h3>
        <div
          className="mt-2 flex h-24 items-end gap-[3px]"
          role="img"
          aria-label="Messages per day, last 30 days"
        >
          {bars.map((b) => (
            <div
              key={b.day}
              title={`${b.day}: ${b.count} message${b.count === 1 ? '' : 's'}`}
              className={`flex-1 rounded-t ${b.count > 0 ? 'bg-indigo-500/100' : 'bg-slate-800'}`}
              style={{ height: `${Math.max(4, (b.count / maxCount) * 100)}%` }}
            />
          ))}
        </div>
      </div>

      {/* Chat history */}
      <div className={`${cardCls} divide-y divide-slate-800`}>
        <div className="p-6">
          <h2 className="text-lg text-slate-100">Chat history</h2>
          <p className="mt-1 text-sm text-slate-400">
            Rename or delete your saved conversations with the Praxly tutor.
          </p>
        </div>
        {chats.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No chats yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {chats.map((chat) => (
              <li key={chat.id} className="flex items-center gap-3 px-6 py-3">
                <MessageSquare size={16} className="shrink-0 text-slate-500" />
                {renamingId === chat.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(chat.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className={`${inputCls} max-w-xs py-1`}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                    {chat.title ?? 'Untitled chat'}
                  </span>
                )}
                <span className="hidden text-xs text-slate-500 sm:block">
                  {new Date(chat.updatedAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => {
                    setRenamingId(chat.id);
                    setRenameValue(chat.title ?? '');
                  }}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                  title="Rename chat"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(chat.id)}
                  className="rounded-full p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  title="Delete chat"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
