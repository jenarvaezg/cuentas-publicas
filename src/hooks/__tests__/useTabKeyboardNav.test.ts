import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTabKeyboardNav } from "../useTabKeyboardNav";

const TABS = ["a", "b", "c"] as const;
type Tab = (typeof TABS)[number];

function createKeyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
}

describe("useTabKeyboardNav", () => {
  it("ArrowRight moves to next tab", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "a" as Tab, setActiveTab));
    const event = createKeyEvent("ArrowRight");
    result.current.onKeyDown(event);
    expect(setActiveTab).toHaveBeenCalledWith("b");
  });

  it("ArrowRight wraps from last to first tab", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "c" as Tab, setActiveTab));
    const event = createKeyEvent("ArrowRight");
    result.current.onKeyDown(event);
    expect(setActiveTab).toHaveBeenCalledWith("a");
  });

  it("ArrowLeft moves to previous tab", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "b" as Tab, setActiveTab));
    const event = createKeyEvent("ArrowLeft");
    result.current.onKeyDown(event);
    expect(setActiveTab).toHaveBeenCalledWith("a");
  });

  it("ArrowLeft wraps from first to last tab", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "a" as Tab, setActiveTab));
    const event = createKeyEvent("ArrowLeft");
    result.current.onKeyDown(event);
    expect(setActiveTab).toHaveBeenCalledWith("c");
  });

  it("Home moves to first tab", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "c" as Tab, setActiveTab));
    const event = createKeyEvent("Home");
    result.current.onKeyDown(event);
    expect(setActiveTab).toHaveBeenCalledWith("a");
  });

  it("End moves to last tab", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "a" as Tab, setActiveTab));
    const event = createKeyEvent("End");
    result.current.onKeyDown(event);
    expect(setActiveTab).toHaveBeenCalledWith("c");
  });

  it("unrelated key does not call setActiveTab or preventDefault", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "a" as Tab, setActiveTab));
    const event = createKeyEvent("Enter");
    result.current.onKeyDown(event);
    expect(setActiveTab).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("activeTab not in tabs array does nothing", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "z" as Tab, setActiveTab));
    const event = createKeyEvent("ArrowRight");
    result.current.onKeyDown(event);
    expect(setActiveTab).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("preventDefault is called on handled keys", () => {
    const setActiveTab = vi.fn();
    const { result } = renderHook(() => useTabKeyboardNav(TABS, "b" as Tab, setActiveTab));
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      const event = createKeyEvent(key);
      result.current.onKeyDown(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    }
  });
});
