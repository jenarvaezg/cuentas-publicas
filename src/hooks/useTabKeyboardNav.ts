import { useCallback } from "react";

/**
 * Provides an `onKeyDown` handler for a `role="tablist"` container.
 * Supports Left/Right arrows to cycle through tabs and Home/End to jump.
 */
export function useTabKeyboardNav<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  setActiveTab: (tab: T) => void,
) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = tabs.indexOf(activeTab);
      if (idx === -1) return;

      let next: number | null = null;
      switch (e.key) {
        case "ArrowRight":
          next = (idx + 1) % tabs.length;
          break;
        case "ArrowLeft":
          next = (idx - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = tabs.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      setActiveTab(tabs[next]);
    },
    [tabs, activeTab, setActiveTab],
  );

  return { onKeyDown };
}
