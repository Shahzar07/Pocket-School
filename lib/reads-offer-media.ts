/** Fixed frames written by scripts/build-reads-offer-assets.ts. */
export const COVER_WIDTH = 640;
export const COVER_HEIGHT = 960;
export const BOOK_3D_WIDTH = 880;
export const BOOK_3D_HEIGHT = 1100;
export const EBOOK_WIDTH = 760;
export const EBOOK_HEIGHT = 980;
export const FAN_WIDTH = 1600;
export const FAN_HEIGHT = 860;
export const PHONE_WIDTH = 780;
export const PHONE_HEIGHT = 1580;
export const TABLET_WIDTH = 1100;
export const TABLET_HEIGHT = 1460;
export const LAPTOP_WIDTH = 1600;
export const LAPTOP_HEIGHT = 1040;

export interface OfferStill {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export const OFFER_COVERS: (OfferStill & { id: string; label: string })[] = [
  {
    id: 'yellow-window',
    label: 'Children’s story',
    src: '/reads/offer/covers/yellow-window.webp',
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    alt: 'Cover of The yellow window, a children’s picture book on Poket Reads.',
  },
  {
    id: 'blue-notebook',
    label: 'Primary',
    src: '/reads/offer/covers/blue-notebook.webp',
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    alt: 'Cover of The Blue Notebook, a Primary story on Poket Reads.',
  },
  {
    id: 'harbour-light',
    label: 'Novel',
    src: '/reads/offer/covers/harbour-light.webp',
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    alt: 'Cover of The Harbour Light, a novel on Poket Reads.',
  },
  {
    id: 'malacca',
    label: 'Lower Secondary',
    src: '/reads/offer/covers/malacca.webp',
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    alt: 'Cover of A Short History of Malacca, Lower Secondary history on Poket Reads.',
  },
  {
    id: 'cells-to-systems',
    label: 'IGCSE',
    src: '/reads/offer/covers/cells-to-systems.webp',
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    alt: 'Cover of Cells to Systems, an IGCSE biology book on Poket Reads.',
  },
  {
    id: 'plain-contract',
    label: 'LLB',
    src: '/reads/offer/covers/plain-contract.webp',
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    alt: 'Cover of Plain Words for Contract, an LLB book on Poket Reads.',
  },
];

export const OFFER_BOOKS_3D: OfferStill[] = [
  {
    src: '/reads/offer/mockups/book-cells.webp',
    width: BOOK_3D_WIDTH,
    height: BOOK_3D_HEIGHT,
    alt: 'A printed copy of Cells to Systems, angled so the spine and the page edges show.',
  },
  {
    src: '/reads/offer/mockups/book-harbour.webp',
    width: BOOK_3D_WIDTH,
    height: BOOK_3D_HEIGHT,
    alt: 'A printed copy of The Harbour Light, angled so the spine and the page edges show.',
  },
];

export const OFFER_EBOOKS: OfferStill[] = [
  {
    src: '/reads/offer/mockups/ebook-contract.webp',
    width: EBOOK_WIDTH,
    height: EBOOK_HEIGHT,
    alt: 'Plain Words for Contract shown as an ebook on a tablet.',
  },
  {
    src: '/reads/offer/mockups/ebook-yellow.webp',
    width: EBOOK_WIDTH,
    height: EBOOK_HEIGHT,
    alt: 'The yellow window shown as an ebook on a tablet.',
  },
];

export const OFFER_FAN: OfferStill = {
  src: '/reads/offer/mockups/fan.webp',
  width: FAN_WIDTH,
  height: FAN_HEIGHT,
  alt: 'Six Poket Reads covers in a fan: The yellow window, The Blue Notebook, The Harbour Light, A Short History of Malacca, Cells to Systems, and Plain Words for Contract.',
};

export const OFFER_DEVICES: OfferStill[] = [
  {
    src: '/reads/offer/devices/phone-shelf.webp',
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    alt: 'A phone showing the Poket Reads shelf, with the seeded books and the reading goal.',
  },
  {
    src: '/reads/offer/devices/tablet-reader.webp',
    width: TABLET_WIDTH,
    height: TABLET_HEIGHT,
    alt: 'A tablet showing the Poket Reads reader open on The Harbour Light.',
  },
  {
    src: '/reads/offer/devices/laptop-ask.webp',
    width: LAPTOP_WIDTH,
    height: LAPTOP_HEIGHT,
    alt: 'A laptop showing Ask ET beside a chapter of The Harbour Light.',
  },
];
