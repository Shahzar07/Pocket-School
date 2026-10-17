import { Instrument_Serif } from 'next/font/google';

/**
 * Self-hosted so the reader keeps its serif without a render-blocking
 * request to fonts.googleapis.com on every page.
 */
export const readerSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
});
