export interface PipRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PipCardBox {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const MARGIN = 16;
const CARD_W = 372;
const CARD_H = 320;

/**
 * Keep the Pip card inside the viewport, including the space the lesson and
 * quiz docks reserve at the bottom. The card does not use a translate, because
 * the open animation replaces CSS transforms and that was pushing it off 390px.
 */
export function placePipCard(input: {
  viewportWidth: number;
  viewportHeight: number;
  rect: PipRect | null;
  dockBottom?: number;
}): PipCardBox {
  const dock = Math.max(0, input.dockBottom ?? 0);
  const width = Math.max(160, Math.min(CARD_W, input.viewportWidth - MARGIN * 2));
  const maxHeight = Math.max(160, input.viewportHeight - MARGIN * 2 - dock);
  const cardH = Math.min(CARD_H, maxHeight);
  const maxTop = Math.max(MARGIN, input.viewportHeight - dock - MARGIN - cardH);
  if (!input.rect) {
    const centered = Math.round((input.viewportHeight - cardH) / 2);
    return { top: Math.min(Math.max(MARGIN, centered), maxTop), left: MARGIN, width, maxHeight };
  }
  const below = input.rect.top + input.rect.height + MARGIN;
  const above = input.rect.top - cardH - MARGIN;
  const preferred = below + cardH <= input.viewportHeight - dock - MARGIN ? below : above;
  const top = Math.min(Math.max(MARGIN, preferred), maxTop);
  const left = Math.min(Math.max(MARGIN, input.rect.left), input.viewportWidth - MARGIN - width);
  return { top, left, width, maxHeight };
}
