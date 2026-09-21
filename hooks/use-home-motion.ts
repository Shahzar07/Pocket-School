"use client";

import { useEffect, type RefObject } from "react";

/** Progressive enhancement: markup is visible before JS and with motion disabled. */
export function useHomeMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 641px)");
    const revealed = new WeakSet<HTMLElement>();
    let dispose = () => {};

    const setup = () => {
      dispose();
      if (reduced.matches) return;
      const animations = new Map<HTMLElement, Animation>();
      const hero = root.querySelector<HTMLElement>("[data-home-hero]");
      let frame = 0;
      let heroVisible = false;
      let heroHeight = hero?.offsetHeight ?? 1;
      const animate = (element: HTMLElement, frames: Keyframe[], delay = 0) => {
        if (element.contains(document.activeElement) || document.hidden) return;
        const animation = element.animate(frames, {
          duration: 720,
          delay,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          // Hold the first frame during stagger delays, then release to CSS.
          fill: "backwards",
        });
        animations.set(element, animation);
        animation.onfinish = () => animations.delete(element);
      };
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const element = entry.target as HTMLElement;
            observer.unobserve(element);
            revealed.add(element);
            if (element.dataset.homeReveal === "chart") {
              element
                .querySelectorAll<HTMLElement>("[data-home-bar]")
                .forEach((bar, index) => {
                  animate(
                    bar,
                    [{ transform: "scaleY(0.12)" }, { transform: "scaleY(1)" }],
                    index * 45,
                  );
                });
              const track =
                element.querySelector<HTMLElement>("[data-home-track]");
              if (track)
                animate(track, [
                  { transform: "scaleX(0.15)" },
                  { transform: "scaleX(1)" },
                ]);
            } else {
              const distance = desktop.matches ? 22 : 12;
              const delay = Number(element.dataset.homeDelay ?? 0);
              animate(
                element,
                [
                  { opacity: 0.65, translate: `0 ${distance}px` },
                  { opacity: 1, translate: "0 0" },
                ],
                delay,
              );
            }
          }
        },
        // Begin just before content enters the viewport, avoiding a visible reset.
        { threshold: 0, rootMargin: "0px 0px 48px 0px" },
      );
      root.querySelectorAll<HTMLElement>("[data-home-reveal]").forEach((el) => {
        // Never replay content already visible on hydration, a deep link, or
        // a live motion-preference change. SSR content stays visible.
        if (el.getBoundingClientRect().top < window.innerHeight)
          revealed.add(el);
        if (!revealed.has(el)) observer.observe(el);
      });

      const updateHero = () => {
        frame = 0;
        if (!hero || !heroVisible || document.hidden || !desktop.matches)
          return;
        const progress = Math.min(
          1,
          Math.max(0, -hero.getBoundingClientRect().top / heroHeight),
        );
        hero.style.setProperty("--hero-depth", progress.toFixed(4));
      };
      const schedule = () => {
        if (heroVisible && desktop.matches && !document.hidden && !frame)
          frame = requestAnimationFrame(updateHero);
      };
      const heroObserver = new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible) schedule();
      });
      if (hero) heroObserver.observe(hero);
      const resize = () => {
        heroHeight = hero?.offsetHeight ?? 1;
        if (!desktop.matches) hero?.style.removeProperty("--hero-depth");
        schedule();
      };
      const settle = () => {
        animations.forEach((animation) => animation.cancel());
        animations.clear();
        if (!document.hidden) schedule();
      };
      const focus = (event: FocusEvent) => {
        for (const [element, animation] of animations) {
          if (element.contains(event.target as Node)) {
            animation.cancel();
            animations.delete(element);
          }
        }
      };
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", resize, { passive: true });
      document.addEventListener("visibilitychange", settle);
      window.addEventListener("pageshow", settle);
      root.addEventListener("focusin", focus);
      dispose = () => {
        observer.disconnect();
        heroObserver.disconnect();
        cancelAnimationFrame(frame);
        animations.forEach((animation) => animation.cancel());
        animations.clear();
        hero?.style.removeProperty("--hero-depth");
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", settle);
        window.removeEventListener("pageshow", settle);
        root.removeEventListener("focusin", focus);
      };
    };
    setup();
    reduced.addEventListener("change", setup);
    return () => {
      dispose();
      reduced.removeEventListener("change", setup);
    };
  }, [rootRef]);
}
