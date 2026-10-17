/** Adaptive viewport sizes for tabular pages.
 * Keep headers and pagination outside the scrolling region; leave space for
 * page navigation and filters. `dvh` follows browser/OS viewport changes.
 * Pages containing compact secondary tables can still override viewportHeight.
 */
export const PAGE_TABLE_HEIGHT = {
  xs: 'clamp(300px, calc(100dvh - 240px), 760px)',
  sm: 'clamp(360px, calc(100dvh - 265px), 1200px)'
};

export const PACKING_TABLE_HEIGHT = {
  xs: 'clamp(290px, calc(100dvh - 270px), 690px)',
  sm: 'clamp(345px, calc(100dvh - 310px), 1100px)'
};
