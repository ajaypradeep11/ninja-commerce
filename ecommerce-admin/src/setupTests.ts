import '@testing-library/jest-dom/vitest';

// jsdom lacks APIs Radix UI primitives (Select, dnd) rely on.
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.releasePointerCapture = () => {};

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverStub;
