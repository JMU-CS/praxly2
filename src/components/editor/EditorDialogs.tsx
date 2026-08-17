import { ConfirmModal } from '../ConfirmModal';
import { LANG_LABELS, type SupportedLang } from '../LanguageSelector';
import { getExampleById } from '../../utils/sampleCodes';

/** How CodeMirror's undo shortcut is spelled on this platform. */
const UNDO_KEY = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Cmd+Z' : 'Ctrl+Z';

interface EditorDialogsProps {
  /** Language the user asked to switch to when the program couldn't be translated. */
  pendingLangSwitch: SupportedLang | null;
  /** Example id awaiting confirmation to replace a non-blank editor. */
  pendingExampleId: string | null;
  /** True while confirming replacing a non-blank editor with the demo program. */
  pendingDemoLoad: boolean;
  /** True while confirming emptying a non-blank editor. */
  pendingClear: boolean;
  /** True while confirming a full reset of this browser's saved state. */
  pendingReset: boolean;
  onConfirmLangSwitch: (lang: SupportedLang) => void;
  onCancelLangSwitch: () => void;
  onConfirmExample: (exampleId: string) => void;
  onCancelExample: () => void;
  onConfirmDemo: () => void;
  onCancelDemo: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
  onConfirmReset: () => void;
  onCancelReset: () => void;
}

/** The editor's five "this will discard your work" confirmations. */
export function EditorDialogs({
  pendingLangSwitch,
  pendingExampleId,
  pendingDemoLoad,
  pendingClear,
  pendingReset,
  onConfirmLangSwitch,
  onCancelLangSwitch,
  onConfirmExample,
  onCancelExample,
  onConfirmDemo,
  onCancelDemo,
  onConfirmClear,
  onCancelClear,
  onConfirmReset,
  onCancelReset,
}: EditorDialogsProps) {
  return (
    <>
      {/* Asks before discarding a program that can't be translated. */}
      {pendingLangSwitch && (
        <ConfirmModal
          title="Translation not available"
          message={`This program can't be translated to ${LANG_LABELS[pendingLangSwitch]}. You can start fresh with an empty ${LANG_LABELS[pendingLangSwitch]} program instead — your current code will be discarded.`}
          confirmLabel="Start fresh"
          cancelLabel="Keep my code"
          onConfirm={() => onConfirmLangSwitch(pendingLangSwitch)}
          onCancel={onCancelLangSwitch}
        />
      )}

      {/* Asks before replacing a non-blank editor with an example program. */}
      {pendingExampleId && (
        <ConfirmModal
          title="Replace current code?"
          message={`Loading "${getExampleById(pendingExampleId)?.title ?? 'this example'}" replaces your current code. You can press ${UNDO_KEY} to undo.`}
          confirmLabel="Load example"
          cancelLabel="Keep my code"
          onConfirm={() => onConfirmExample(pendingExampleId)}
          onCancel={onCancelExample}
        />
      )}

      {/* Asks before replacing a non-blank editor with the demo program. */}
      {pendingDemoLoad && (
        <ConfirmModal
          title="Replace current code?"
          message={`Loading the demo program replaces your current code. You can press ${UNDO_KEY} to undo.`}
          confirmLabel="Load demo"
          cancelLabel="Keep my code"
          onConfirm={onConfirmDemo}
          onCancel={onCancelDemo}
        />
      )}

      {/* Asks before emptying a non-blank editor. */}
      {pendingClear && (
        <ConfirmModal
          title="Clear current code?"
          message={`Clearing empties the editor. You can press ${UNDO_KEY} to undo.`}
          confirmLabel="Clear code"
          cancelLabel="Keep my code"
          onConfirm={onConfirmClear}
          onCancel={onCancelClear}
        />
      )}

      {/* Asks before wiping this browser's saved state (Settings → Reset).
          The only one of these that can't be undone with the keyboard. */}
      {pendingReset && (
        <ConfirmModal
          title="Reset Praxly?"
          message="This erases everything Praxly has saved in this browser — your code, editor settings, AI chats, and API key — then reloads. You will be signed out, and this cannot be undone."
          confirmLabel="Reset and reload"
          cancelLabel="Cancel"
          onConfirm={onConfirmReset}
          onCancel={onCancelReset}
        />
      )}
    </>
  );
}
