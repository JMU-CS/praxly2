import { Suspense, lazy } from 'react';
import type { ComponentProps } from 'react';

// Blockly is ~700 KB minified — split it out so only users who open a
// Blocks pane download it.
const BlocklyPane = lazy(() => import('./BlocklyPane').then((m) => ({ default: m.BlocklyPane })));

export function BlocklyPaneLazy(props: ComponentProps<typeof BlocklyPane>) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-xs text-muted">
          Loading blocks…
        </div>
      }
    >
      <BlocklyPane {...props} />
    </Suspense>
  );
}
