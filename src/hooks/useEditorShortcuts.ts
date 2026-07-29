/**
 * F5 / Shift+F5 / F10 keyboard shortcuts for running and debugging.
 *
 * The handlers close over fresh state on every render, so they are read through
 * a ref — the document listener itself is registered only once.
 */

import { useEffect, useRef } from 'react';

interface Shortcuts {
  isDebugging: boolean;
  isDebugComplete: boolean;
  onRun: () => void;
  onDebugStart: () => void;
  onDebugStep: () => void;
  onDebugStop: () => void;
}

export function useEditorShortcuts(actions: Shortcuts) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const current = actionsRef.current;

      if (e.key === 'F5') {
        e.preventDefault();
        if (e.shiftKey) {
          if (current.isDebugging) current.onDebugStop();
          else current.onDebugStart();
        } else if (!current.isDebugging) {
          current.onRun();
        }
      } else if (e.key === 'F10' && current.isDebugging && !current.isDebugComplete) {
        e.preventDefault();
        current.onDebugStep();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
