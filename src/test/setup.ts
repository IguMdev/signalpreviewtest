import "@testing-library/jest-dom/vitest";

// Mock matchMedia (usado por sonner/radix em jsdom).
if (!window.matchMedia) {
  // @ts-expect-error – jsdom shim
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}