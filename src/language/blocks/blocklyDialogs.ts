/**
 * Replaces Blockly's native window.alert/confirm/prompt dialogs (used for
 * "Create variable…", rename, delete-all, …) with modals styled like the
 * rest of Praxly, so the Blocks view never breaks the app's dark theme.
 */

import * as Blockly from 'blockly';

let registered = false;

/** Installs the themed dialogs. Safe to call more than once. */
export function registerPraxlyDialogs(): void {
  if (registered) return;
  registered = true;

  Blockly.dialog.setAlert((message, callback) => {
    openModal({ message, onDone: () => callback?.() });
  });

  Blockly.dialog.setConfirm((message, callback) => {
    openModal({ message, cancellable: true, onDone: (r) => callback(r !== null) });
  });

  Blockly.dialog.setPrompt((message, defaultValue, callback) => {
    openModal({ message, input: defaultValue, cancellable: true, onDone: callback });
  });
}

interface ModalOptions {
  message: string;
  /** When set (even to ''), an input is shown seeded with this value. */
  input?: string;
  cancellable?: boolean;
  /** Resolves with the input value (or '' for plain dialogs); null = cancelled. */
  onDone: (result: string | null) => void;
}

function openModal({ message, input, cancellable, onDone }: ModalOptions): void {
  const overlay = el(
    'div',
    'fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/70'
  );
  const card = el(
    'div',
    'w-80 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.7)]'
  );

  const text = el('p', 'text-sm text-slate-200');
  text.textContent = message;
  card.appendChild(text);

  let field: HTMLInputElement | null = null;
  if (input !== undefined) {
    field = el(
      'input',
      'mt-3 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm ' +
        'text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500'
    );
    field.value = input;
    card.appendChild(field);
  }

  const buttons = el('div', 'mt-4 flex justify-end gap-2');
  const finish = (result: string | null) => {
    overlay.remove();
    onDone(result);
  };

  if (cancellable) {
    const cancel = el(
      'button',
      'rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors'
    );
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => finish(null));
    buttons.appendChild(cancel);
  }

  const ok = el(
    'button',
    'rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors'
  );
  ok.textContent = 'OK';
  ok.addEventListener('click', () => finish(field ? field.value : ''));
  buttons.appendChild(ok);
  card.appendChild(buttons);

  overlay.appendChild(card);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(field ? field.value : '');
    if (e.key === 'Escape') finish(cancellable ? null : '');
    e.stopPropagation();
  });
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) finish(cancellable ? null : '');
  });

  document.body.appendChild(overlay);
  (field ?? ok).focus();
  field?.select();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
