'use client';

import { useEffect, useMemo, useState } from 'react';
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3';
import type { GeoPlace } from '@/lib/insights/census';

interface MapFeature {
  code: string;
  geometry: GeoPermissibleObjects;
}

function mix(from: string, to: string, amount: number): string {
  const parse = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const start = parse(from);
  const end = parse(to);
  const channel = (index: number) => Math.round((start[index] ?? 0) + ((end[index] ?? 0) - (start[index] ?? 0)) * amount);
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

/** Choropleth of grouped student counts. Loaded only when the panel opens. */
export function WorldMap({
  places,
  selected,
  onPick,
}: {
  places: readonly GeoPlace[];
  selected: string;
  onPick: (country: string) => void;
}) {
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [{ feature }, atlasMod, countriesMod] = await Promise.all([
          import('topojson-client'),
          import('world-atlas/countries-110m.json'),
          import('i18n-iso-countries'),
        ]);
        const countries = countriesMod.default;
        const atlas = atlasMod.default;
        const collection = feature(atlas, atlas.objects.countries);
        const rows = collection.features.flatMap((item) => {
          if (!item.geometry) return [];
          const code = countries.numericToAlpha2(String(item.id ?? '')) ?? '';
          return code ? [{ code, geometry: item.geometry as GeoPermissibleObjects }] : [];
        });
        if (!cancelled) setFeatures(rows);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const place of places) map.set(place.country, place.students);
    return map;
  }, [places]);
  const max = Math.max(1, ...counts.values());
  const projection = useMemo(() => geoMercator().fitSize([720, 360], { type: 'Sphere' }), []);
  const path = useMemo(() => geoPath(projection), [projection]);

  if (failed) {
    return <p className="rounded-2xl bg-[#F6F1E7] px-4 py-8 text-sm text-[#1A3C34]">The map could not load. Country totals are in the table below.</p>;
  }

  return (
    <svg viewBox="0 0 720 360" role="img" aria-label="World map of grouped student counts" className="h-auto w-full rounded-2xl bg-[#102820]">
      <rect width="720" height="360" fill="#102820" />
      {features.map((item) => {
        const count = counts.get(item.code) ?? 0;
        const active = selected === item.code;
        const outline = path(item.geometry);
        if (!outline) return null;
        return (
          <path
            key={item.code}
            d={outline}
            fill={count ? mix('#F8E7C4', '#C8922A', Math.min(1, count / max)) : '#1A3C34'}
            stroke={active ? '#3C8DFF' : '#0B1F1A'}
            strokeWidth={active ? 1.4 : 0.4}
            className="cursor-pointer"
            onClick={() => onPick(item.code)}
          >
            <title>{`${item.code}: ${count} students`}</title>
          </path>
        );
      })}
    </svg>
  );
}
