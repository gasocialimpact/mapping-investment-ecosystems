// Place data derived from the Georgia Community Data Explorer bundle by
// scripts/fetch-place-data.mjs. Array fields are positional: scores/pctiles
// align with metricKeys, demo/change/par/parBench align with
// demographics.labels, percap aligns with cie.programs.

export interface PlaceCounty {
  fips: string;
  county: string;
  lat: number;
  lng: number;
  scores: number[];
  pctiles: number[];
  catScores: (number | null)[];
  catPctiles: (number | null)[];
  demo: (number | null)[];
  change: (number | null)[];
  drivers: [string, number, string][];
  parBench: (number | null)[];
  cieArea: string;
}

export interface PlaceTract {
  geoid: string;
  name: string;
  county: string;
  scores: number[];
  pctiles: number[];
  par: (number | null)[];
}

export interface CieArea {
  type: string;
  percap: (number | null)[];
}

export interface CieData {
  programs: string[];
  usPerCapita: (number | null)[];
  areas: Record<string, CieArea>;
}

export interface PlaceDemographics {
  labels: string[];
  units: string[];
  groups: string[];
  changeNote: string;
  benchmarkName: string;
  stateBenchmark: (number | null)[];
  usBenchmark: (number | null)[];
}

export interface PlaceParMeasures {
  labels: string[];
  groups: string[];
  units: string[];
  stateBenchmark: (number | null)[];
  usBenchmark: (number | null)[];
  stateName: string;
}

export interface PlaceCountyData {
  generatedAt: string;
  source: string;
  metricKeys: string[];
  metricLabels: string[];
  nationalMedians: number[];
  demographics: PlaceDemographics;
  // Labels + national medians for the 8 CVI category scores (catScores).
  profile: { labels: string[]; medians: number[] };
  parMeasures: PlaceParMeasures;
  cie: CieData;
  counties: PlaceCounty[];
  shapes: GeoJSON.FeatureCollection;
}

export interface PlaceTractData {
  generatedAt: string;
  tracts: PlaceTract[];
  tractShapes: GeoJSON.FeatureCollection;
}

// 'cvi' | 'baseline' | 'climate' (indexes into metricKeys) or 'demo:N'
// (index N into demographics.labels), or 'none' to hide the choropleth.
export type PlaceMetric = string;
