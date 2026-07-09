/** Random unique id — crypto-based when available, time+random fallback otherwise. */
export function randomId(): string {
  return window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
