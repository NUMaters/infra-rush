const paths: Record<string, string> = {
  helmet: '<path d="M4 15a8 8 0 0 1 16 0M3 15h18v4H3zM10 6v8m4-8v8"/>',
  users:
    '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2.5 20v-2a5.5 5.5 0 0 1 11 0v2zm11 0v-2a5.5 5.5 0 0 0-1.2-3.5A5.5 5.5 0 0 1 21.5 18v2z"/>',
  home: '<path d="m3 11 9-8 9 8v10H3zM9 21v-7h6v7"/>',
  mine: '<path d="M3 18h9v3H3zM5 18v-7h5v7m0-6 6-7 4 9m-5 1h7l-2 4h-4zM3 9h8"/>',
  build:
    '<path d="M2 16h20M3 20V8m18 12V8M3 12l6-5 6 5 6-5M3 12h18M8 12v4m8-4v4"/>',
  upgrade: '<path d="M3 19h18M5 19v-7m14 7v-7M8 9l4-5 4 5m-4-5v11"/>',
  repair: '<path d="m14 6 4 4 3-3a6 6 0 0 1-8 7l-7 7-3-3 7-7a6 6 0 0 1 7-8z"/>',
  embank: '<path d="m2 20 6-9 4 4 3-10 7 15zM2 20h20"/>',
  clear: '<path d="M3 19h18M5 15h12l4-5M4 11h9M6 6h13"/>',
  destroy:
    '<path d="m14 3 7 7-4 4-7-7zm-4 4-6 6 7 7 6-6M4 13l-2 9 9-2M7 10l7 7"/>',
  march: '<path d="M3 12h16m-6-6 6 6-6 6M4 5h3M4 19h3"/>',
  stone: '<path d="m3 17 2-10 7-4 7 4 2 10-8 4zm2-10 7 5 7-5m-7 5 1 9"/>',
  iron: '<path d="M4 4h16v4h-5v8h5v4H4v-4h5V8H4z"/>',
  soil: '<path d="m2 18 6-8 4 3 3-7 7 12zM3 21h18"/>',
  crown: '<path d="m3 6 5 4 4-7 4 7 5-4-2 14H5z"/>',
  castle:
    '<path d="M3 21V8h4V5h3v3h4V5h3v3h4v13H3zM9 21v-5a3 3 0 0 1 6 0v5M3 12h18"/>',
  sound:
    '<path d="m3 9 5 0 5-5v16l-5-5H3zm14-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.helmet}</svg>`;
