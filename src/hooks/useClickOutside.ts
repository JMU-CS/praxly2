import { useEffect } from 'react';

/**
 * Closes a dropdown/menu when the user clicks outside of it.
 *
 * @param active       Only listens while true (menu is open).
 * @param containerSelector  CSS selector for the menu's container element.
 * @param onOutside    Called when a click lands outside the container.
 */
export function useClickOutside(
  active: boolean,
  containerSelector: string,
  onOutside: () => void
): void {
  useEffect(() => {
    if (!active) return;

    const handleClick = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(containerSelector)) onOutside();
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [active, containerSelector, onOutside]);
}
