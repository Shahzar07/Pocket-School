"use client";
import { useEffect } from "react";

export default function Motion() {
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    async function animate() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const context = gsap.context(() => {
        gsap.from(".hero-copy > *", {
          y: 12,
          opacity: 0,
          duration: 0.65,
          stagger: 0.07,
          ease: "power3.out",
          clearProps: "all",
        });
        gsap.from(".hero-workspace", {
          y: 20,
          opacity: 0,
          duration: 0.85,
          delay: 0.15,
          ease: "power3.out",
          clearProps: "all",
        });
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
          gsap.from(element, {
            y: 16,
            opacity: 0,
            duration: 0.65,
            ease: "power3.out",
            scrollTrigger: { trigger: element, start: "top 94%", once: true },
            clearProps: "all",
          });
        });
      }, ".poket-home");
      cleanup = () => context.revert();
    }
    void animate();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  return null;
}
