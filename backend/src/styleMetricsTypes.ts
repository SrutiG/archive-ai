export interface StyleMetrics {
  overallShape: string;
  fitProfile: string;
  volumeDistribution: { top: number; bottom: number };
  dominantLines: string[];
  colorExperimentationIndex: number;
  numberOfColors: number;
  numberOfPatterns: number;
}

export interface ItemTraitSource {
  id?: string;
  title: string;
  category?: string;
  subCategory?: string;
  colors?: string[] | null;
  styleTags?: string[] | null;
}
