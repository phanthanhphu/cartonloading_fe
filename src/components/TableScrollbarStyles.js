/**
 * Always show the native table scrollbar when a vertical viewport is used.
 * When content fits, the browser draws a full-length, stationary thumb.
 * When it overflows, the same thumb shrinks and scrolls normally.
 * Retaining a dedicated scrollbar lane avoids the white empty gutter that
 * appeared when scrollbar-gutter was stable but overflow-y was only auto.
 *
 * Keep native overflow: keyboard, mouse wheel, touchpad, scroll position,
 * sticky header and both scrolling axes retain their browser behavior.
 */
export const tableScrollbarSx = {
  overflowY: 'scroll',
  scrollbarGutter: 'stable',
  scrollbarColor: '#8595A9 #EFF3F8',
  '&::-webkit-scrollbar': {
    width: '12px',
    height: '12px'
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#EFF3F8'
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#8595A9',
    borderRadius: '8px',
    border: '2px solid #EFF3F8'
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: '#687C95'
  }
};
