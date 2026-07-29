import { ConfirmModal } from '../ConfirmModal';
import { LANG_LABELS, type SupportedLang } from '../LanguageSelector';
import { getExampleById } from '../../utils/sampleCodes';

interface EditorDialogsProps {
  /** Language the user asked to switch to when the program couldn't be translated. */
  pendingLangSwitch: SupportedLang | null;
  /** Example id awaiting confirmation to replace a non-blank editor. */
  pendingExampleId: string | null;
  /** True while confirming replacing a non-blank editor with the demo program. */
  pendingDemoLoad: boolean;
  onConfirmLangSwitch: (lang: SupportedLang) => void;
  onCancelLangSwitch: () => void;
  onConfirmExample: (exampleId: string) => void;
  onCancelExample: () => void;
  onConfirmDemo: () => void;
  onCancelDemo: () => void;
}

/** The editor's three "this will discard your code" confirmations. */
export function EditorDialogs({
  pendingLangSwitch,
  pendingExampleId,
  pendingDemoLoad,
  onConfirmLangSwitch,
  onCancelLangSwitch,
  onConfirmExample,
  onCancelExample,
  onConfirmDemo,
  onCancelDemo,
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
          message={`Loading "${getExampleById(pendingExampleId)?.title ?? 'this example'}" will replace your current code. This can't be undone.`}
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
          message="Loading the demo program will replace your current code. This can't be undone."
          confirmLabel="Load demo"
          cancelLabel="Keep my code"
          onConfirm={onConfirmDemo}
          onCancel={onCancelDemo}
        />
      )}
    </>
  );
}
