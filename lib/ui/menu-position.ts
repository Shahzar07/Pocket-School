/** Keep a menu inside the viewport. Never use a negative left offset. */

export function menuPosition(
  anchor: { left: number; top: number; bottom: number },
  viewport: { width: number; height: number },
  menu: { width: number; height: number } = { width: 288, height: 240 },
  pad = 12,
): { left: number; top: number } {
  let left = anchor.left;
  if (left < pad) left = pad;
  if (left + menu.width > viewport.width - pad) {
    left = Math.max(pad, viewport.width - pad - menu.width);
  }
  let top = anchor.bottom + 8;
  if (top + menu.height > viewport.height - pad) {
    top = Math.max(pad, anchor.top - menu.height - 8);
  }
  return { left, top };
}
