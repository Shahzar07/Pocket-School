"use client";

import { useEffect, type RefObject } from "react";

/** Progressive enhancement: markup is visible before JS and with motion disabled. */
export function useHomeMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 641px)");
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
        if (element.contains(document.activeElement)) return;
        const animation = element.animate(frames, {
          duration: 720,
          delay,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "none",
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
            // Nodes already passed on a restored deep link need no entrance.
            if (entry.boundingClientRect.bottom < 0) continue;
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
        { threshold: 0.12 },
      );
      root
        .querySelectorAll<HTMLElement>("[data-home-reveal]")
        .forEach((el) => observer.observe(el));

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
      document.addEventListener("visibilitychange", schedule);
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
        document.removeEventListener("visibilitychange", schedule);
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
