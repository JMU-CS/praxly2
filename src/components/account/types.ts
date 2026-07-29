/** Shared types for the account manager's sections. */

/** Which pane of the account manager is showing. */
export type Section = 'home' | 'personal' | 'security' | 'ai' | 'profile' | 'data';

/** Raises the page-level status banner from inside a section. */
export type Notify = (kind: 'success' | 'error', text: string) => void;
