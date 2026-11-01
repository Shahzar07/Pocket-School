'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Scroll reveals and a small hero parallax.
 * Lenis is skipped under reduced motion and in automated browsers so
 * window.scrollTo stays native for tests. Reveals move on the y axis only,
 * so text stays readable if a shot is taken mid-scroll.
 */
export function usePremiumMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const automated = navigator.webdriver;
    if (reduce) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      let lenisDestroy: (() => void) | undefined;
      if (!automated) {
        const { default: Lenis } = await import('lenis');
        if (cancelled) return;
        const lenis = new Lenis({ autoRaf: true });
        lenis.on('scroll', ScrollTrigger.update);
        lenisDestroy = () => lenis.destroy();
      }

      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((item, index) => {
          gsap.from(item, {
            y: 22,
            duration: 0.7,
            delay: (index % 4) * 0.06,
            ease: 'power2.out',
            immediateRender: false,
            scrollTrigger: { trigger: item, start: 'top 90%' },
          });
        });
        const mock = node.querySelector('[data-hero-mock]');
        const hero = node.querySelector('[data-hero]');
        if (mock && hero) {
          gsap.to(mock, {
            y: 32,
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
          });
        }
      }, node);

      cleanup = () => {
        context.revert();
        lenisDestroy?.();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [root]);
}
