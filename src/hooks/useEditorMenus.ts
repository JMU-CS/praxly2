/**
 * The editor header's three dropdowns. Only one of the header menus is open at
 * a time, and each closes when the user clicks anywhere outside it.
 */

import { useCallback, useState } from 'react';

import { useClickOutside } from './useClickOutside';

export function useEditorMenus() {
  const [showSourceLangDropdown, setShowSourceLangDropdown] = useState(false);
  const [showExamplesMenu, setShowExamplesMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  useClickOutside(showSourceLangDropdown, '.source-lang-dropdown', () =>
    setShowSourceLangDropdown(false)
  );
  useClickOutside(showSettingsMenu, '.settings-dropdown', () => setShowSettingsMenu(false));
  useClickOutside(showExamplesMenu, '.examples-dropdown', () => setShowExamplesMenu(false));

  const toggleSourceLangDropdown = useCallback(
    () => setShowSourceLangDropdown((prev) => !prev),
    []
  );

  const toggleExamplesMenu = useCallback(() => {
    setShowExamplesMenu((prev) => !prev);
    setShowSettingsMenu(false);
  }, []);

  const toggleSettingsMenu = useCallback(() => {
    setShowSettingsMenu((prev) => !prev);
    setShowExamplesMenu(false);
  }, []);

  const closeSourceLangDropdown = useCallback(() => setShowSourceLangDropdown(false), []);

  /** Closes the header menus — used when one of their items is chosen. */
  const closeHeaderMenus = useCallback(() => {
    setShowSettingsMenu(false);
    setShowExamplesMenu(false);
  }, []);

  return {
    showSourceLangDropdown,
    showExamplesMenu,
    showSettingsMenu,
    toggleSourceLangDropdown,
    toggleExamplesMenu,
    toggleSettingsMenu,
    closeSourceLangDropdown,
    closeHeaderMenus,
  };
}
