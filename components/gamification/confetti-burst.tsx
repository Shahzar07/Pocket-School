'use client';

import { useEffect, useRef } from 'react';
import { BRAND } from '@/lib/brand';

const COLOURS = [BRAND.blueDeep, BRAND.primary, BRAND.blueBright, BRAND.amber, BRAND.cyan, BRAND.good, BRAND.mint];

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colour: string;
  life: number;
}

export function ConfettiBurst() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const bits: Bit[] = Array.from({ length: 70 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 3,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * -7 - 2,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)] ?? BRAND.primary,
      life: 1,
    }));
    let frame = 0;
    let handle = 0;
    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const bit of bits) {
        bit.x += bit.vx;
        bit.y += bit.vy;
        bit.vy += 0.18;
        bit.life -= 0.012;
        context.globalAlpha = Math.max(bit.life, 0);
        context.fillStyle = bit.colour;
        context.fillRect(bit.x, bit.y, 7, 5);
      }
      context.globalAlpha = 1;
      frame += 1;
      if (frame < 90) handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <canvas
      ref={ref}
      width={640}
      height={360}
      className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-64 w-full max-w-3xl"
      aria-hidden="true"
    />
  );
}
