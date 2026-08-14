import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import type { WorkspaceSvg } from 'blockly';

import { praxlyTheme, PRAXLY_TOOLBOX, registerPraxlyBlocks } from '../../language/blocks/blockDefs';
import { registerPraxlyDialogs } from '../../language/blocks/blocklyDialogs';

interface BlocklyPaneProps {
  /** Blockly workspace serialization JSON (the Blocks "source code"). */
  value: string;
  /** Read-only panes render translations; editable panes edit the source. */
  readOnly?: boolean;
  /** Fired with the new serialization JSON after every user edit. */
  onChange?: (json: string) => void;
  /** Block text size in px — the same value the code editors use. */
  fontSize?: number;
}

/**
 * Locks a translation pane's blocks: whole top-level chains stay draggable so
 * the user can arrange them, but child blocks are pinned to their parents (a
 * chain can't be taken apart), and nothing is deletable or editable.
 *
 * The workspace itself is injected editable rather than with Blockly's
 * `readOnly` option — read-only workspaces make every block immovable, which
 * both freezes the view and silently disables `cleanUp()` (it only arranges
 * movable blocks), leaving freshly loaded chains overlapping.
 */
function lockBlocks(workspace: WorkspaceSvg): void {
  for (const block of workspace.getAllBlocks(false)) {
    block.setDeletable(false);
    block.setEditable(false);
    block.contextMenu = false;
    block.setMovable(block.getParent() === null);
  }
}

/**
 * Hosts a Blockly workspace inside a panel. Editable mode shows the block
 * toolbox and reports edits upward as serialization JSON; read-only mode
 * re-renders whenever the incoming translation JSON changes, showing locked
 * blocks (movable chains that can't be edited or taken apart).
 */
export function BlocklyPane({
  value,
  readOnly = false,
  onChange,
  fontSize = 14,
}: BlocklyPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<WorkspaceSvg | null>(null);
  // Last JSON this pane loaded or emitted — used to break the
  // value → onChange → value echo loop.
  const lastJsonRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fontSizeRef = useRef(fontSize);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inject the workspace once per mount / mode.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    registerPraxlyBlocks();
    registerPraxlyDialogs();

    const workspace = Blockly.inject(container, {
      theme: praxlyTheme(fontSizeRef.current),
      renderer: 'zelos',
      toolbox: readOnly ? undefined : PRAXLY_TOOLBOX,
      zoom: { controls: !readOnly, wheel: true, startScale: readOnly ? 0.7 : 0.85 },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: !readOnly,
    });
    workspaceRef.current = workspace;

    // Blockly hides the flyout after a block is dragged out but leaves the
    // flyout's scrollbar visible. Mirror each flyout's visibility onto the
    // flyout scrollbars so they disappear together.
    const syncFlyoutScrollbars = () => {
      const flyouts = container.querySelectorAll<SVGElement>('.blocklyFlyout');
      const anyVisible = [...flyouts].some((f) => f.style.display !== 'none');
      container.querySelectorAll<SVGElement>('.blocklyFlyoutScrollbar').forEach((sb) => {
        sb.style.visibility = anyVisible ? '' : 'hidden';
      });
    };
    const flyoutObserver = new MutationObserver(syncFlyoutScrollbars);
    container.querySelectorAll<SVGElement>('.blocklyFlyout').forEach((flyout) => {
      flyoutObserver.observe(flyout, { attributes: true, attributeFilter: ['style'] });
    });

    if (!readOnly) {
      // Extend the dynamic Functions flyout with the return block.
      workspace.registerToolboxCategoryCallback('PROCEDURE', (ws) => [
        ...Blockly.Procedures.flyoutCategory(ws),
        { kind: 'block', type: 'praxly_return' },
      ]);

      workspace.addChangeListener((event: Blockly.Events.Abstract) => {
        // UI-only events (clicks, selection, viewport) don't change the code.
        if (event.isUiEvent || workspace.isDragging()) return;
        const json = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
        if (json === lastJsonRef.current) return;
        lastJsonRef.current = json;
        onChangeRef.current?.(json);
      });
    }

    // Keep the SVG sized to the panel as the user drags panel dividers.
    const resizeObserver = new ResizeObserver(() => Blockly.svgResize(workspace));
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      flyoutObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
      lastJsonRef.current = null;
    };
  }, [readOnly]);

  // Follow the app's Settings → text size: a fresh theme makes Blockly
  // re-measure and re-render all blocks at the new font size.
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || fontSizeRef.current === fontSize) return;
    fontSizeRef.current = fontSize;
    workspace.setTheme(praxlyTheme(fontSize));
    // Theme refresh recolors blocks but doesn't re-measure them; mark every
    // block dirty so outlines grow/shrink with the new text size.
    workspace.getAllBlocks(false).forEach((block) => block.markDirty());
    workspace.render();
  }, [fontSize]);

  // Load external value changes (translations, language switches, examples).
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || value === lastJsonRef.current) return;

    try {
      Blockly.Events.disable();
      if (value.startsWith('//')) {
        // Translation fallback comment — the program uses features the
        // Blocks view doesn't cover; show the reason instead of blocks.
        workspace.clear();
        setLoadError(value.replace(/^\/\/\s*/, ''));
      } else if (value.trim()) {
        Blockly.serialization.workspaces.load(JSON.parse(value), workspace);
        setLoadError(null);
        if (readOnly) lockBlocks(workspace);
        workspace.cleanUp();
      } else {
        workspace.clear();
        setLoadError(null);
      }
    } catch (e) {
      workspace.clear();
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      lastJsonRef.current = value;
      Blockly.Events.enable();
    }
  }, [value, readOnly]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loadError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90 p-6">
          <p className="max-w-xs text-center text-xs text-slate-400">
            This program can't be shown as blocks.
            <span className="mt-2 block font-mono text-xs text-slate-500">{loadError}</span>
          </p>
        </div>
      )}
    </div>
  );
}
