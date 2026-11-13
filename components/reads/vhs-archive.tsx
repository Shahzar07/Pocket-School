'use client';

import { useEffect, useRef } from 'react';
import { Inter_Tight, Newsreader, Noto_Sans_JP } from 'next/font/google';
import './vhs-archive.css';

const interTight = Inter_Tight({ subsets: ['latin'], weight: ['500', '600'], variable: '--lva-sans', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'], variable: '--lva-serif', display: 'swap' });
const notoJp = Noto_Sans_JP({ weight: ['500', '800'], variable: '--lva-jp', display: 'swap', preload: false });

/* ── Artwork: four sheets, every spine and cover is a crop ── */

const HIGGS = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2F';

const SHEET: Record<string, [string, number, number]> = {
  covers: [`${HIGGS}hf_20261029_010644_837e04ca-2418-45c1-b8e0-0233265c4cd5.png&w=1744&q=85`, 1744, 2336],
  spines: [`${HIGGS}hf_20261029_010738_a3e47ead-18f2-4974-9468-06d16a25edc5.png&w=2688&q=85`, 2688, 1152],
  fix: [`${HIGGS}hf_20261029_010831_3ebb874b-93dc-433e-87ed-6299aba720f0.png&w=1520&q=85`, 1520, 2688],
  fix2: [`${HIGGS}hf_20261029_092020_f96bc094-db7b-46de-9298-074a24e0a3b8.png&w=1520&q=85`, 1520, 2688],
};

type Crop = [sheet: string, x: number, y: number, w: number, h: number];

const CROP: Record<string, Crop> = {
  'spine-valley': ['spines', 266, 31, 189, 1089], 'cover-valley': ['covers', 497, 72, 344, 659],
  'spine-bluehour': ['spines', 492, 31, 189, 1089], 'cover-bluehour': ['covers', 914, 72, 342, 659],
  'spine-river': ['fix', 197, 54, 324, 2566], 'cover-river': ['covers', 1332, 72, 344, 659],
  'spine-summer': ['spines', 937, 31, 188, 1089], 'cover-summer': ['covers', 74, 813, 344, 676],
  'spine-green': ['spines', 1157, 31, 185, 1090], 'cover-green': ['covers', 497, 815, 344, 674],
  'spine-noon': ['spines', 44, 32, 184, 1088], 'cover-noon': ['covers', 74, 72, 347, 659],
  'spine-observer': ['fix2', 371, 15, 349, 2655], 'cover-observer': ['covers', 915, 815, 342, 675],
  'spine-birds': ['spines', 1573, 31, 183, 1089], 'cover-birds': ['covers', 1331, 815, 345, 675],
  'spine-storm': ['fix2', 808, 15, 347, 2656], 'cover-storm': ['covers', 74, 1571, 345, 681],
  'spine-tide': ['spines', 2012, 31, 188, 1089], 'cover-tide': ['covers', 496, 1577, 343, 678],
  'spine-war': ['spines', 2236, 31, 189, 1089], 'cover-war': ['covers', 913, 1579, 343, 676],
  'spine-door': ['spines', 2462, 31, 188, 1089], 'cover-door': ['covers', 1331, 1579, 344, 677],
};

interface Film { id: string; title: string; romaji: string; kanji: string; year: number; genre: string; min: number; synopsis: string }

const FILMS: Film[] = [
  { id: 'valley', title: 'The Silent Valley', romaji: 'SHIZUKANA TANI', kanji: '静かな谷', year: 1958, genre: 'Drama', min: 104, synopsis: 'A schoolteacher returns to the mountain village that exiled her father, and finds the valley has kept every one of its secrets.' },
  { id: 'bluehour', title: 'The Blue Hour', romaji: 'AO NO TOKI', kanji: '青の刻', year: 1962, genre: 'Romance', min: 97, synopsis: 'Over one long evening in a harbour town, a widow and a stranger trade small lies until the light runs out.' },
  { id: 'river', title: 'River of Salt', romaji: 'SHIO NO KAWA', kanji: '塩の川', year: 1964, genre: 'Drama', min: 121, synopsis: 'Two brothers drag a salt barge downriver to a city that no longer wants anything they carry.' },
  { id: 'summer', title: 'The Last Summer', romaji: 'SAIGO NO NATSU', kanji: '最後の夏', year: 1966, genre: 'Drama', min: 109, synopsis: 'The summer before the dam floods their village, three friends set fire to everything they cannot take with them.' },
  { id: 'green', title: 'The Green Road', romaji: 'MIDORI NO MICHI', kanji: '緑の道', year: 1969, genre: 'Mystery', min: 101, synopsis: 'A surveyor mapping a forest road keeps finding the same footprints, always one day ahead of him.' },
  { id: 'noon', title: 'Noon in Ashes', romaji: 'HAI NO SHOGO', kanji: '灰の正午', year: 1971, genre: 'Western', min: 112, synopsis: 'A rider crosses a white desert to settle an old debt, and learns too late who sent him.' },
  { id: 'observer', title: 'The Observer', romaji: 'KANSATSUSHA', kanji: '観察者', year: 1973, genre: 'Thriller', min: 96, synopsis: 'A night watchman begins to suspect that the building he guards has started watching him back.' },
  { id: 'birds', title: 'The Fallen Birds', romaji: 'OCHITA TORI', kanji: '落ちた鳥', year: 1975, genre: 'Drama', min: 118, synopsis: 'When the birds stop singing over a frontier town, the mayor’s daughter is the only one who goes looking for the reason.' },
  { id: 'storm', title: 'Light in the Storm', romaji: 'ARASHI NO HI', kanji: '嵐の灯', year: 1978, genre: 'Drama', min: 127, synopsis: 'A lighthouse keeper and his son wait out a three-day storm with a shipwrecked sailor who will not give his name.' },
  { id: 'tide', title: 'The Long Tide', romaji: 'NAGAI SHIO', kanji: '長い潮', year: 1981, genre: 'Drama', min: 99, synopsis: 'A fisherman’s wife counts the tides on the harbour wall while her husband’s boat fails to come home.' },
  { id: 'war', title: 'A Quiet War', romaji: 'SHIZUKANA SENSO', kanji: '静かな戦争', year: 1985, genre: 'Comedy', min: 103, synopsis: 'Two neighbours fight a silent war over a garden wall for thirty years, and neither will say how it began.' },
  { id: 'door', title: 'Red Door', romaji: 'AKAI TOBIRA', kanji: '赤い扉', year: 1989, genre: 'Thriller', min: 114, synopsis: 'A projectionist follows a reel of unknown film through the corridors of a cinema on its final night.' },
];

const N = FILMS.length;
const COPIES = 3;
const TOTAL = N * COPIES;
const Y0 = 1955;
const Y1 = 1990;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const INK: [number, number, number][] = [[150, 330, 0], [340, 600, 120], [250, 120, 220], [90, 760, 300], [400, 250, 360], [260, 860, 420], [230, 470, 180]];

function cropStyle(key: string): string {
  const [sheet, x, y, w, h] = CROP[key];
  const [url, W, H] = SHEET[sheet];
  return `background-image:url("${url}");background-size:${(W / w) * 100}% ${(H / h) * 100}%;background-position:${(x / (W - w)) * 100}% ${(y / (H - h)) * 100}%;`;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const mod = (a: number, n: number) => ((a % n) + n) % n;

export function VhsArchive({ backHref = '/reads' }: { backHref?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;

    Object.values(SHEET).forEach(([url]) => { const img = new Image(); img.src = url; });

    const stage = $<HTMLDivElement>('.lva-stage');
    const shelf = $<HTMLElement>('.lva-shelf');
    const probe = $<HTMLDivElement>('.lva-probe');
    const ring = $<HTMLDivElement>('.lva-ring');
    const dot = $<HTMLDivElement>('.lva-tl-dot');
    const cursor = $<HTMLDivElement>('.lva-cursor');
    const detail = $<HTMLDivElement>('.lva-detail');
    const poster = $<SVGImageElement>('.lva-poster image');
    const circles = Array.from(root.querySelectorAll<SVGCircleElement>('.lva-ink circle'));

    /* Tapes */
    interface Tape { el: HTMLDivElement; sp: HTMLDivElement; cv: HTMLDivElement; lift: number; hover: boolean }
    const tapes: Tape[] = [];
    stage.textContent = '';
    for (let v = 0; v < TOTAL; v += 1) {
      const film = FILMS[v % N];
      const el = document.createElement('div');
      el.className = 'lva-tape';
      el.dataset.v = String(v);
      const sp = document.createElement('div');
      sp.className = 'lva-face lva-sp';
      sp.style.cssText = cropStyle(`spine-${film.id}`);
      const cv = document.createElement('div');
      cv.className = 'lva-face lva-cv';
      cv.style.cssText = cropStyle(`cover-${film.id}`);
      el.append(sp, cv);
      stage.append(el);
      const tape: Tape = { el, sp, cv, lift: 0, hover: false };
      el.addEventListener('pointerenter', () => { tape.hover = true; });
      el.addEventListener('pointerleave', () => { tape.hover = false; });
      tapes.push(tape);
    }

    /* Timeline ticks */
    const ticks = $<HTMLDivElement>('.lva-tl-ticks');
    ticks.textContent = '';
    for (let year = Y0; year <= Y1; year += 1) {
      const major = (year - Y0) % 5 === 0;
      const tick = document.createElement('i');
      tick.className = major ? 'lva-tick lva-major' : 'lva-tick';
      tick.style.left = `${((year - Y0) / (Y1 - Y0)) * 100}%`;
      ticks.append(tick);
      if (major) {
        const label = document.createElement('span');
        label.className = 'lva-year';
        if (year === Y0) label.classList.add('lva-first');
        if (year === Y1) label.classList.add('lva-last');
        if (((year - Y0) / 5) % 2 === 1) label.classList.add('lva-odd');
        label.style.left = `${((year - Y0) / (Y1 - Y0)) * 100}%`;
        label.textContent = String(year);
        ticks.append(label);
      }
    }

    /* Geometry */
    let W = 0, Hh = 0, H = 0, ws = 0, d = 0, gap = 0, U = 0, cy = 0;
    const P = 1400;
    let XS: number[] = [];
    const measure = () => {
      W = root.clientWidth;
      Hh = root.clientHeight;
      H = probe.offsetHeight;
      ws = (H * 142) / 840;
      d = (H * 474) / 900;
      gap = H * 0.035;
      U = H * (W < 768 ? 1.05 : 1.3);
      const box = shelf.getBoundingClientRect();
      cy = box.top + box.height / 2;
      XS = [0];
      let acc = 0;
      for (let u = 2; u <= U * 3; u += 2) {
        acc += 2 / (1 + Math.pow(u / U, 1.6));
        XS.push(acc);
      }
      for (const tape of tapes) {
        tape.sp.style.width = `${ws}px`;
        tape.sp.style.left = `${-ws / 2}px`;
        tape.sp.style.transform = `translateZ(${d / 2}px)`;
        tape.cv.style.width = `${d}px`;
        tape.cv.style.left = `${-d / 2}px`;
        tape.cv.style.transform = `rotateY(90deg) translateZ(${ws / 2}px)`;
      }
      ring.style.left = `${W / 2 - d / 2 - 6}px`;
      ring.style.top = `${cy + 0.36 * H}px`;
    };
    const B = (r: number) => (Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * 0.5);
    const F = (r: number) => r * (ws + gap) + (d - ws + 1.4 * gap) * B(r);
    const scl = (u: number) => 1 / (1 + Math.pow(Math.abs(u) / U, 1.6));
    const xsc = (u: number) => {
      const a = Math.abs(u) / 2;
      const i = Math.min(XS.length - 1, Math.floor(a));
      const j = Math.min(XS.length - 1, i + 1);
      return Math.sign(u) * (XS[i] + (XS[j] - XS[i]) * (a - Math.floor(a)));
    };
    const rel = (v: number, s: number) => mod(v - s + TOTAL / 2, TOTAL) - TOTAL / 2;

    /* State */
    let s = 5 + N;
    let T = s;
    let dragging = false;
    let dragged = false;
    let open = false;
    let active = -1;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let cx = mx, cyy = my;
    let tiltX = 0, tiltY = 0;
    let dotYear = FILMS[5].year;
    let inkStart = 0;
    let last = performance.now();
    let frame = 0;
    const running: Animation[] = [];

    /* Caption */
    const masks = {
      title: $<HTMLDivElement>('.lva-cap-title'),
      sub: $<HTMLDivElement>('.lva-cap-sub'),
      year: $<HTMLDivElement>('.lva-cap-year'),
    };
    const swap = (mask: HTMLDivElement, text: string, dir: number) => {
      const next = document.createElement('span');
      next.textContent = text;
      const old = Array.from(mask.children) as HTMLElement[];
      mask.append(next);
      if (reduce || dir === 0) { old.forEach(node => node.remove()); return; }
      next.animate([{ transform: `translateY(${dir * 105}%)` }, { transform: 'translateY(0)' }], { duration: 650, easing: EASE, fill: 'both' });
      for (const node of old) {
        const from = getComputedStyle(node).transform;
        const out = node.animate([{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: `translateY(${-dir * 105}%)` }], { duration: 650, easing: EASE, fill: 'both' });
        out.onfinish = () => node.remove();
      }
    };
    const caption = (index: number, dir: number) => {
      const film = FILMS[index];
      swap(masks.title, film.title, dir);
      swap(masks.sub, `${film.romaji} / ${film.kanji}`, dir);
      swap(masks.year, `${film.year} — ${film.genre.toUpperCase()}`, dir);
    };

    /* Detail sheet */
    const coverRect = () => {
      const centre = tapes.reduce((best, tape, v) => (Math.abs(rel(v, s)) < Math.abs(rel(best, s)) ? v : best), 0);
      return tapes[centre].cv.getBoundingClientRect();
    };
    const inset = (box: DOMRect) => `inset(${box.top}px ${W - box.right}px ${Hh - box.bottom}px ${box.left}px round 3px)`;
    const stop = () => { running.splice(0).forEach(animation => animation.cancel()); };
    const openDetail = () => {
      if (open) return;
      T = Math.round(T);
      const film = FILMS[mod(Math.round(T), N)];
      $<HTMLElement>('.lva-d-sub').textContent = `${film.romaji} / ${film.kanji}`;
      $<HTMLElement>('.lva-d-title').textContent = film.title;
      $<HTMLElement>('.lva-d-meta').textContent = `${film.year} / ${film.genre.toUpperCase()} / ${film.min} min`;
      $<HTMLElement>('.lva-d-syn').textContent = film.synopsis;
      const [sheet, x, y, w, h] = CROP[`cover-${film.id}`];
      const [url, SW, SH] = SHEET[sheet];
      poster.setAttribute('href', url);
      poster.setAttribute('x', String((-x * 474) / w));
      poster.setAttribute('y', String((-y * 900) / h));
      poster.setAttribute('width', String((SW * 474) / w));
      poster.setAttribute('height', String((SH * 900) / h));
      circles.forEach(circle => circle.setAttribute('r', '0'));
      open = true;
      stop();
      detail.hidden = false;
      detail.scrollTop = 0;
      const sheetTime = reduce ? 1 : 1050;
      running.push(detail.animate([{ clipPath: inset(coverRect()) }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: sheetTime, easing: 'cubic-bezier(.76,0,.18,1)', fill: 'both' }));
      detail.querySelectorAll<HTMLElement>('.lva-ln > *').forEach((line, i) => {
        running.push(line.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], { duration: reduce ? 1 : 900, delay: reduce ? 0 : 620 + i * 75, easing: EASE, fill: 'both' }));
      });
      inkStart = performance.now() + (reduce ? -5000 : 520);
      $<HTMLButtonElement>('.lva-close').focus({ preventScroll: true });
    };
    const closeDetail = () => {
      if (!open) return;
      open = false;
      const back = detail.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: inset(coverRect()) }], { duration: reduce ? 1 : 850, easing: 'cubic-bezier(.76,0,.18,1)', fill: 'both' });
      back.onfinish = () => { if (!open) { detail.hidden = true; stop(); back.cancel(); } };
    };

    /* Frame */
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ease = (rate: number) => (reduce ? 1 : 1 - Math.exp(-rate * dt));
      s += (T - s) * ease(dragging ? 18 : 5.2);
      if (Math.abs(T - s) < 0.0005) s = T;
      if (s > TOTAL * 4 || s < -TOTAL * 4) { const shift = Math.round(s / TOTAL) * TOTAL; s -= shift; T -= shift; }

      const index = mod(Math.round(s), N);
      if (index !== active) { caption(index, active === -1 ? 0 : Math.sign(T - s) || 1); active = index; }

      const settled = Math.abs(T - s) < 0.3;
      const onCover = fine && !open && settled && Math.abs(mx - W / 2) < 0.55 * d && Math.abs(my - cy) < 0.55 * H;
      const aimY = onCover ? ((mx - W / 2) / (0.55 * d)) * 8 : ((mx - W / 2) / W) * 4;
      const aimX = onCover ? (-(my - cy) / (H / 2)) * 5 : 0;
      tiltY += (aimY - tiltY) * ease(7);
      tiltX += (aimX - tiltX) * ease(7);

      tapes.forEach((tape, v) => {
        const r = rel(v, s);
        const o = smooth(Math.max(0, 1 - Math.abs(r)));
        const u = F(r);
        if (Math.abs(u) > U * 1.95) { tape.el.style.display = 'none'; return; }
        tape.el.style.display = '';
        tape.lift += ((tape.hover && Math.abs(r) > 0.5 && !dragging ? 1 : 0) - tape.lift) * ease(12);
        const sc = scl(u);
        const k = 1 / sc;
        const z = P * (1 - k) + o * H * 0.1;
        const x = xsc(u) * k;
        const y = (H * 0.5 * (1 - sc) * 0.42 + o * H * 0.012 - tape.lift * H * 0.05) * k;
        const ry = Math.sign(u) * Math.min(1, Math.abs(u) / U) * 26 * (1 - o) - 90 * o + tiltY * o;
        tape.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${(tiltX * o).toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
        tape.el.style.zIndex = String(Math.round(3000 + z));
        tape.sp.style.setProperty('--shade', Math.min(0.6, o * 0.55 + (1 - sc) * 0.32).toFixed(3));
        tape.cv.style.setProperty('--shade', ((1 - o) * 0.82).toFixed(3));
      });

      /* Timeline dot */
      const base = Math.floor(s);
      const a = FILMS[mod(base, N)].year;
      const b = FILMS[mod(base + 1, N)].year;
      const f = s - base;
      const target = b < a ? (f < 0.5 ? a : b) : a + (b - a) * f;
      dotYear = Math.abs(target - dotYear) > 6 ? target : dotYear + (target - dotYear) * ease(14);
      dot.style.left = `${((dotYear - Y0) / (Y1 - Y0)) * 100}%`;

      ring.style.transform = `scale(${open ? 0 : smooth(Math.max(0, 1 - Math.abs(T - s) * 3)).toFixed(3)})`;

      if (fine) {
        const follow = reduce ? 1 : 1 - Math.exp(-16 * dt);
        cx += (mx - cx) * follow;
        cyy += (my - cyy) * follow;
        cursor.style.transform = `translate3d(${cx - 29}px,${cyy - 29}px,0)`;
        cursor.classList.toggle('lva-open', onCover);
      }

      if (open) {
        const t = now - inkStart;
        circles.forEach((circle, i) => {
          const p = Math.max(0, Math.min(1, (t - INK[i][2]) / 1250));
          circle.setAttribute('r', String(720 * (1 - Math.pow(1 - p, 3))));
        });
      }
      frame = requestAnimationFrame(tick);
    };

    /* Inputs */
    const step = (by: number) => { if (!open) T = Math.round(T) + by; };
    let downX = 0, T0 = 0, pointerId = -1;
    const onDown = (event: PointerEvent) => {
      if (open || event.button > 0) return;
      dragging = true; dragged = false; downX = event.clientX; T0 = T; pointerId = event.pointerId;
    };
    const onMove = (event: PointerEvent) => {
      mx = event.clientX; my = event.clientY;
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - downX;
      if (!dragged && Math.abs(dx) > 5) dragged = true;
      if (dragged) T = T0 - dx / (ws + gap);
    };
    const onUp = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      if (dragged) T = Math.round(T);
    };
    const onShelfClick = (event: MouseEvent) => {
      if (dragged) { dragged = false; return; }
      const el = (event.target as HTMLElement).closest<HTMLElement>('.lva-tape');
      if (!el || open) return;
      const r = rel(Number(el.dataset.v), Math.round(T));
      if (Math.abs(r) < 0.5) openDetail(); else T = Math.round(T + r);
    };
    let wheelTimer = 0;
    const onWheel = (event: WheelEvent) => {
      if (open) return;
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      T += (delta / (ws + gap)) * 0.5;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => { T = Math.round(T); }, 160);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (open) { event.stopPropagation(); closeDetail(); } return; }
      if (open) return;
      if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'Enter' && !(event.target as HTMLElement).closest('a,button')) { event.preventDefault(); openDetail(); }
    };
    const onTimeline = (event: MouseEvent) => {
      if (open) return;
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const year = Y0 + ((event.clientX - box.left) / box.width) * (Y1 - Y0);
      let best = 0;
      FILMS.forEach((film, i) => { if (Math.abs(film.year - year) < Math.abs(FILMS[best].year - year)) best = i; });
      const here = Math.round(T);
      let by = mod(best - here, N);
      if (by > N / 2) by -= N;
      T = here + by;
    };
    const onOver = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      cursor.classList.toggle('lva-btn', Boolean(target.closest('a,button,.lva-tl-hit')));
      cursor.classList.toggle('lva-spine', Boolean(target.closest('.lva-tape')));
    };

    const prev = $<HTMLButtonElement>('.lva-prev');
    const next = $<HTMLButtonElement>('.lva-next');
    const hit = $<HTMLDivElement>('.lva-tl-hit');
    const close = $<HTMLButtonElement>('.lva-close');
    const goPrev = () => step(-1);
    const goNext = () => step(1);
    shelf.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    shelf.addEventListener('click', onShelfClick);
    root.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    root.addEventListener('pointerover', onOver);
    prev.addEventListener('click', goPrev);
    next.addEventListener('click', goNext);
    hit.addEventListener('click', onTimeline);
    ring.addEventListener('click', openDetail);
    close.addEventListener('click', closeDetail);
    window.addEventListener('resize', measure);

    measure();
    root.classList.toggle('lva-fine', fine);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(wheelTimer);
      stop();
      shelf.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      shelf.removeEventListener('click', onShelfClick);
      root.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      root.removeEventListener('pointerover', onOver);
      prev.removeEventListener('click', goPrev);
      next.removeEventListener('click', goNext);
      hit.removeEventListener('click', onTimeline);
      ring.removeEventListener('click', openDetail);
      close.removeEventListener('click', closeDetail);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const brand = (
    <>
      <span className="lva-lbl">Leon Vasari</span>
      <i className="lva-brand-line" aria-hidden />
      <span className="lva-lbl">Film Archive</span>
    </>
  );

  return (
    <div ref={rootRef} className={`lva ${interTight.variable} ${newsreader.variable} ${notoJp.variable}`}>
      <svg className="lva-defs" aria-hidden width="0" height="0">
        <filter id="lva-grain-f">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 .45  0 0 0 0 .42  0 0 0 0 .38  0 0 0 .22 0" />
        </filter>
      </svg>
      <div className="lva-grain" aria-hidden />
      <div className="lva-probe" aria-hidden />

      <header className="lva-top">
        <a className="lva-brand" href={backHref}>{brand}</a>
        <nav className="lva-nav" aria-label="Archive">
          <a className="lva-lbl" href="#films">Films</a>
          <a className="lva-lbl" href="#about">About</a>
          <a className="lva-lbl" href="#journal">Journal</a>
          <button type="button" className="lva-burger" aria-label="Menu"><i /><i /></button>
        </nav>
      </header>

      <div className="lva-kanji lva-k1" aria-hidden>映画</div>
      <div className="lva-kanji lva-k2" aria-hidden>の記憶</div>
      <div className="lva-floor" aria-hidden />

      <section className="lva-shelf" aria-label="Films" id="films">
        <div className="lva-stage" />
      </section>

      <div className="lva-ring" role="button" aria-label="Open this film"><i /></div>

      <div className="lva-cap" aria-live="polite">
        <div className="lva-mask lva-cap-title" />
        <div className="lva-mask lva-cap-sub lva-lbl" />
        <i className="lva-cap-rule" aria-hidden />
        <div className="lva-mask lva-cap-year" />
      </div>
      <button type="button" className="lva-arr lva-prev" aria-label="Previous film">
        <svg width="24" height="12" viewBox="0 0 25 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 1L1 6l5 5M1 6h23" /></svg>
      </button>
      <button type="button" className="lva-arr lva-next" aria-label="Next film">
        <svg width="24" height="12" viewBox="0 0 25 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M19 1l5 5-5 5M24 6H1" /></svg>
      </button>

      <div className="lva-tl">
        <i className="lva-tl-line" aria-hidden />
        <div className="lva-tl-ticks" aria-hidden />
        <div className="lva-tl-dot" aria-hidden />
        <div className="lva-tl-hit" role="slider" aria-label="Year" aria-valuemin={Y0} aria-valuemax={Y1} aria-valuenow={1971} tabIndex={-1} />
      </div>

      <footer className="lva-foot">
        <span className="lva-lbl">© Leon Vasari. All rights reserved.</span>
        <span className="lva-lbl"><a href="#fb">FB</a> / <a href="#tw">TW</a></span>
      </footer>

      <div className="lva-cursor" aria-hidden>
        <i className="lva-cur-ring" />
        <i className="lva-cur-dot" />
        <span className="lva-cur-label">OPEN<br />開く</span>
      </div>

      <div className="lva-detail" hidden role="dialog" aria-modal="true" aria-label="Film details">
        <button type="button" className="lva-close lva-lbl lva-box">Close / 閉じる</button>
        <div className="lva-d-brand">{brand}</div>
        <div className="lva-d-left">
          <div className="lva-ln"><p className="lva-d-sub lva-lbl" /></div>
          <div className="lva-ln"><h2 className="lva-d-title" /></div>
          <div className="lva-ln"><p className="lva-d-meta lva-lbl" /></div>
          <div className="lva-ln"><p className="lva-d-syn" /></div>
          <div className="lva-ln"><p className="lva-d-credit">Written and directed by Leon Vasari. 監督作品</p></div>
          <div className="lva-ln"><button type="button" className="lva-watch lva-lbl">Watch the film / 映画を見る</button></div>
        </div>
        <div className="lva-d-right">
          <svg className="lva-poster" viewBox="0 0 474 900" aria-hidden>
            <defs>
              <filter id="lva-ink-f" x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="3" seed="7" />
                <feDisplacementMap in="SourceGraphic" scale="120" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <mask id="lva-ink-m" maskUnits="userSpaceOnUse" x="0" y="0" width="474" height="900">
                <g className="lva-ink" filter="url(#lva-ink-f)" fill="#fff">
                  {INK.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0} />)}
                </g>
              </mask>
              <clipPath id="lva-poster-c"><rect width="474" height="900" /></clipPath>
            </defs>
            <g clipPath="url(#lva-poster-c)" mask="url(#lva-ink-m)">
              <image preserveAspectRatio="none" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
