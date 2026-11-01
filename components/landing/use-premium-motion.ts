'use client';

import { useEffect, type RefObject } from 'react';

/** cubic-bezier(0.22, 1, 0.36, 1). One curve for every tween. */
function easeOut(progress: number): number {
  const x1 = 0.22;
  const y1 = 1;
  const x2 = 0.36;
  const y2 = 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const slope = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  let u = progress;
  for (let i = 0; i < 6; i += 1) {
    const delta = sampleX(u) - progress;
    const derivative = slope(u);
    if (Math.abs(delta) < 1e-4 || derivative === 0) break;
    u -= delta / derivative;
  }
  return sampleY(Math.min(1, Math.max(0, u)));
}

/**
 * One load entrance, then short fade-and-rise reveals.
 * Lenis is skipped under prefers-reduced-motion and in automated browsers so
 * window.scrollTo stays native for tests. The hero product view may drift 8px.
 */
export function usePremiumMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const automated = navigator.webdriver;
    if (reduce || automated) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const { default: Lenis } = await import('lenis');
      if (cancelled) return;
      const lenis = new Lenis({ autoRaf: true, lerp: 0.12 });
      lenis.on('scroll', ScrollTrigger.update);

      const context = gsap.context(() => {
        const entering = gsap.utils.toArray<HTMLElement>('[data-enter]').slice(0, 6);
        gsap.from(entering, {
          y: 8,
          opacity: 0,
          duration: 0.45,
          stagger: 0.05,
          ease: easeOut,
        });
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((item) => {
          gsap.from(item, {
            y: 8,
            opacity: 0,
            duration: 0.4,
            ease: easeOut,
            immediateRender: false,
            scrollTrigger: { trigger: item, start: 'top 88%' },
          });
        });
        const mock = node.querySelector('[data-hero-mock]');
        const hero = node.querySelector('[data-hero]');
        if (mock && hero) {
          gsap.to(mock, {
            y: 8,
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
          });
        }
      }, node);

      cleanup = () => {
        context.revert();
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [root]);
}
