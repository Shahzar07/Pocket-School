declare module 'topojson-client' {
  export function feature(topology: unknown, object: unknown): {
    type: 'FeatureCollection';
    features: Array<{
      id?: string | number;
      type: 'Feature';
      geometry: { type: string; coordinates: unknown } | null;
      properties: Record<string, unknown> | null;
    }>;
  };
}

declare module 'world-atlas/countries-110m.json' {
  const atlas: { objects: { countries: object } };
  export default atlas;
}
