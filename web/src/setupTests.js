import '@testing-library/jest-dom/vitest';

// jsdom nao implementa matchMedia (usado por theme.js / useIsDark)
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false, media: '', onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  });
}
