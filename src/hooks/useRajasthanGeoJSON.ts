import { useState, useEffect } from 'react';
import type { GeoPermissibleObjects } from 'd3-geo';

export interface RajasthanGeoFeature {
  type: 'Feature';
  properties: {
    district?: string;
    dtname?: string;
    name?: string;
    dt_code?: string;
    division?: string;
    st_code?: string;
    st_nm?: string;
    year?: string;
    [key: string]: any;
  };
  geometry: GeoPermissibleObjects;
}

export interface RajasthanFeatureCollection {
  type: 'FeatureCollection';
  features: RajasthanGeoFeature[];
}

const GEOJSON_URL = '/rajasthan-districts-41.geojson';

function isValid41DistrictGeoJSON(data: any): data is RajasthanFeatureCollection {
  return (
    Boolean(data) &&
    data.type === 'FeatureCollection' &&
    Array.isArray(data.features) &&
    data.features.length >= 41
  );
}

// Loads the bundled 41-district boundary file once per page load (no external boundary source).
let cached: RajasthanFeatureCollection | null = null;

export function useRajasthanGeoJSON() {
  const [geoJson, setGeoJson] = useState<RajasthanFeatureCollection | null>(cached);
  const [isLoading, setIsLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    fetch(GEOJSON_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!isValid41DistrictGeoJSON(data)) throw new Error('unexpected boundary file');
        cached = data;
        if (alive) setGeoJson(data);
      })
      .catch((e) => alive && setError(String(e?.message || e)))
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { geoJson, isLoading, error };
}
