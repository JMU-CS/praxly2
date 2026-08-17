/**
 * The "start over" escape hatch behind Settings → Reset.
 *
 * Everything Praxly keeps between visits lives in localStorage — the editor
 * session, text size, chat cache, BYOK settings, AI preferences, and the auth
 * tokens. A deployment that changes the shape of any of those can leave a
 * browser holding state the new build can't make sense of, and a user has no
 * other way out of that. Wiping the origin's storage and reloading puts them
 * back to a first-visit state.
 *
 * Deliberately unconditional: it clears the whole origin rather than a list of
 * known keys, because the keys a *previous* build wrote are exactly the ones
 * that aren't in any list the current build could hold.
 */

/**
 * Clears persisted state and reloads.
 *
 * The arguments exist so tests can drive it without a DOM; callers in the app
 * pass nothing. Reloading immediately is what makes clearing safe — the
 * zustand stores still hold their state in memory and would write their keys
 * straight back, but the navigation tears the page down first.
 */
export function resetApp(
  storage: Storage = localStorage,
  reload: () => void = () => window.location.reload()
): void {
  storage.clear();
  reload();
}
