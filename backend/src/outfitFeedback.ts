import type { ItemTraitSource, StyleMetrics } from './styleMetricsTypes';

const stripLeadingMarkers = (value: string): string => value.replace(/^[\s]*[-•*·+]+[\s]*/, '');
const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function defaultNormalizeTitleKey(value: string): string {
  return normalizeWhitespace(stripLeadingMarkers(value || '')).toLowerCase();
}

export interface OutfitFeedback {
  id: string;
  itemIds?: string[];
  itemTitles?: string[];
  type: 'like' | 'dislike';
  feedback?: string;
  createdAt: string;
  prompt?: string;
  styleMetrics?: StyleMetrics | null;
  outfitId?: string;
  outfit?: {
    id: string;
    itemIds: string[];
    itemTitles: string[];
    prompt?: string;
    notes?: string;
    styleMetrics?: StyleMetrics | null;
    createdAt: string;
    saved?: boolean;
  } | null;
}

export interface FeedbackMetricPattern {
  label: string;
  summary: string;
}

export interface FeedbackStylePatternSummary {
  positive: string[];
  negative: string[];
  mixed: string[];
}

export interface FeedbackSignalSummary {
  totalSamples: number;
  positiveHighlights: string[];
  negativeHighlights: string[];
  scenarioHighlights?: string[];
  stylePatterns?: FeedbackStylePatternSummary;
}

export interface SummarizeFeedbackOptions {
  limits?: {
    notes?: number;
  };
  resolveItemTraits?: (title: string, id?: string) => ItemTraitSource | null;
  getEntryContext?: (entry: OutfitFeedback) => { prompt?: string } | null | undefined;
}

const DEFAULT_NOTE_LIMIT = 3;
const DEFAULT_STYLE_PATTERN_LIMIT = 3;
const MIN_PATTERN_SAMPLE_COUNT = 2;
const POSITIVE_RATIO_THRESHOLD = 0.65;
const NEGATIVE_RATIO_THRESHOLD = 0.35;
const NOTE_KEY_STOPWORDS = new Set([
  'the','and','with','from','this','that','for','when','they','them','have','just','very','really','like','liked','love','loved','hate','hated','too','also','but','because','made','make','makes','still','much','more','less','into','onto','over','under','not','does','did','was','were','are','is','am','be','being','been','of','to','in','on','as','it','its','if','we','you','me','my','mine','your','yours','our','ours','their','theirs','she','he','her','his','hers','him','at','by','an','a','so','up','down'
]);

const SCENARIO_DIRECTIVE_KEYWORDS = ['need', 'needs', 'should', 'must', 'avoid', 'swap', 'please', 'no ', "don't", 'do not', "can't", 'cannot'];
const SCENARIO_EVENT_KEYWORDS = ['meeting', 'office', 'work', 'date', 'party', 'wedding', 'lunch', 'dinner', 'event', 'family', 'vacation', 'trip', 'travel', 'brunch', 'interview'];
const AESTHETIC_STYLE_KEYWORDS = ['layer', 'layers', 'layering', 'sheer', 'color', 'colors', 'colour', 'pattern', 'patterns', 'print', 'prints', 'silhouette', 'fit', 'proportion', 'volume', 'texture', 'fabric', 'neckline'];

type NoteClassification = 'scenario' | 'aesthetic';

interface NoteAccumulator {
  key: string;
  phrase: string;
  count: number;
  classification: NoteClassification;
}

interface MetricAccumulator {
  metric: string;
  bucket: string;
  likeCount: number;
  dislikeCount: number;
  likeNotes: Map<string, NoteAccumulator>;
  dislikeNotes: Map<string, NoteAccumulator>;
}

export function normalizeFeedbackSummaryPayload(raw: unknown): FeedbackSignalSummary | null {
  if (!raw) {
    return null;
  }

  let payload: any = raw;
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const totalSamples = Number(payload.totalSamples) || 0;
  const positiveHighlights = dedupeHighlights(normalizeHighlightArray(payload.positiveHighlights ?? payload.likeNotes, 'like'));
  const negativeHighlights = dedupeHighlights(normalizeHighlightArray(payload.negativeHighlights ?? payload.dislikeNotes, 'dislike'));
  const scenarioHighlights = dedupeHighlights(normalizeScenarioHighlightArray(payload.scenarioHighlights));
  const stylePatterns = normalizeStylePatternSummary(payload.stylePatterns ?? payload.metricPatterns);

  const summary: FeedbackSignalSummary = {
    totalSamples,
    positiveHighlights,
    negativeHighlights,
    stylePatterns,
  };

  if (scenarioHighlights.length > 0) {
    summary.scenarioHighlights = scenarioHighlights;
  }

  return summary;
}

function normalizeHighlightArray(value: unknown, sentiment: 'like' | 'dislike'): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(entry => {
      if (typeof entry === 'string') {
        return harmonizeHighlight(entry, sentiment);
      }
      if (entry && typeof entry === 'object') {
        const snippet = typeof (entry as any).snippet === 'string' ? (entry as any).snippet.trim() : '';
        const count = Number((entry as any).count) || 0;
        if (snippet.length > 0) {
          return formatHighlightSnippet(snippet, sentiment, count || 1);
        }
      }
      return null;
    })
    .filter((entry): entry is string => Boolean(entry && entry.length > 0));
}

function normalizeScenarioHighlightArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return dedupeHighlights(
    (value as unknown[])
      .map(entry => {
        if (typeof entry === 'string') {
          const trimmed = entry.trim();
          return trimmed.length > 0 ? trimmed : null;
        }
        if (entry && typeof entry === 'object') {
          const snippet = typeof (entry as any).snippet === 'string' ? (entry as any).snippet.trim() : '';
          const count = Number((entry as any).count) || 0;
          const sentiment = typeof (entry as any).sentiment === 'string' ? ((entry as any).sentiment === 'like' ? 'like' : 'dislike') : 'dislike';
          if (snippet.length > 0) {
            return formatHighlightSnippet(snippet, sentiment, count || 1);
          }
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry && entry.length > 0))
  );
}

function dedupeHighlights(highlights: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  highlights.forEach(highlight => {
    const normalized = highlight.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(highlight);
    }
  });
  return result;
}

function normalizeStylePatternSummary(value: unknown): FeedbackStylePatternSummary | undefined {
  if (!value) {
    return undefined;
  }

  const arrays = value as Record<string, unknown>;

  const normalize = (input: unknown, fallbackSentiment: 'like' | 'dislike'): string[] => {
    if (!input) {
      return [];
    }
    if (Array.isArray(input) && input.every(item => typeof item === 'string')) {
      return dedupeHighlights(input as string[]);
    }
    if (Array.isArray(input)) {
      const usedHighlights = new Set<string>();
      return (input as unknown[])
        .map(entry => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const metric = (entry as any).metric ?? (entry as any).label ?? '';
          const bucket = (entry as any).bucket ?? '';
          const likeCount = Number((entry as any).likeCount) || 0;
          const sampleCount = Number((entry as any).sampleCount) || 0;
          const likeRatio = Number((entry as any).likeRatio);
          const ratioText = Number.isFinite(likeRatio) ? `${Math.round(likeRatio * 100)}% likes` : sampleCount > 0 ? `${likeCount}/${sampleCount} likes` : '';
          const highlightArray = normalizeHighlightArray((entry as any).highlights ?? (entry as any).representativeNotes, fallbackSentiment);
          const highlight = highlightArray.find(note => {
            const normalized = note.toLowerCase();
            if (usedHighlights.has(normalized)) {
              return false;
            }
            usedHighlights.add(normalized);
            return true;
          });
          const summary = typeof (entry as any).summary === 'string' ? (entry as any).summary.trim() : '';
          if (summary) {
            return summary;
          }
          const label = formatMetricLabel(typeof metric === 'string' ? metric : '', typeof bucket === 'string' ? bucket : '');
          const pieces = [label];
          if (ratioText) {
            pieces.push(ratioText);
          }
          if (highlight) {
            pieces.push(`Note: ${stripHighlightPrefix(highlight)}`);
          }
          return pieces.join(' — ');
        })
        .filter((entry): entry is string => Boolean(entry && entry.length > 0));
    }
    return [];
  };

  const positive = normalize(arrays.positive, 'like');
  const negative = normalize(arrays.negative, 'dislike');
  const mixed = normalize(arrays.mixed, 'like');

  if (positive.length === 0 && negative.length === 0 && mixed.length === 0) {
    return undefined;
  }

  return { positive, negative, mixed };
}

export function shouldPersistFeedbackSummary(summary: FeedbackSignalSummary | null): summary is FeedbackSignalSummary {
  return !!summary && summary.totalSamples > 0;
}

export function summarizeFeedbackSignals(
  feedback: OutfitFeedback[] | undefined,
  normalizeTitleKey: (title: string) => string,
  options: SummarizeFeedbackOptions = {}
): FeedbackSignalSummary | null {
  if (!feedback || feedback.length === 0) {
    return null;
  }

  const noteLimit = Math.max(1, options.limits?.notes ?? DEFAULT_NOTE_LIMIT);

  const likeNotes = new Map<string, NoteAccumulator>();
  const dislikeNotes = new Map<string, NoteAccumulator>();
  const metricPatternMap = new Map<string, MetricAccumulator>();

  feedback.forEach(entry => {
    if (entry.feedback) {
      const classification = classifyFeedbackEntry(entry);
      const normalized = entry.feedback.trim();
      if (normalized.length > 0) {
        const targetNotes = entry.type === 'like' ? likeNotes : dislikeNotes;
        recordCondensedNote(targetNotes, normalized, classification);
      }
    }

    const metrics = resolveEntryStyleMetrics(entry);
    const entryClassification = classifyFeedbackEntry(entry);
    if (metrics) {
      recordMetricPattern(metricPatternMap, 'overall_shape', metrics.overallShape || 'balanced', entry, entryClassification);
      recordMetricPattern(metricPatternMap, 'fit_profile', metrics.fitProfile || 'balanced', entry, entryClassification);
      const volumeBucket = bucketVolumeDistribution(metrics.volumeDistribution);
      if (volumeBucket) {
        recordMetricPattern(metricPatternMap, 'volume_distribution', volumeBucket, entry, entryClassification);
      }
      const colorExperimentationBucket = bucketColorExperimentation(metrics.colorExperimentationIndex);
      if (colorExperimentationBucket) {
        recordMetricPattern(metricPatternMap, 'color_experimentation', colorExperimentationBucket, entry, entryClassification);
      }
      const colorCountBucket = bucketColorCount(metrics.numberOfColors);
      if (colorCountBucket) {
        recordMetricPattern(metricPatternMap, 'color_count', colorCountBucket, entry, entryClassification);
      }
      const patternCountBucket = bucketPatternCount(metrics.numberOfPatterns);
      if (patternCountBucket) {
        recordMetricPattern(metricPatternMap, 'pattern_count', patternCountBucket, entry, entryClassification);
      }
      (metrics.dominantLines || [])
        .map(line => line?.trim().toLowerCase())
        .filter((line): line is string => Boolean(line && line.length > 0))
        .forEach(line => recordMetricPattern(metricPatternMap, 'dominant_line', line, entry, entryClassification));
    }
  });

  const positiveHighlights = dedupeHighlights(buildHighlightsFromNotes(likeNotes, 'like', noteLimit, 'aesthetic'));
  const negativeHighlights = dedupeHighlights(buildHighlightsFromNotes(dislikeNotes, 'dislike', noteLimit, 'aesthetic'));
  const scenarioHighlightsRaw = [
    ...buildHighlightsFromNotes(likeNotes, 'like', noteLimit + 2, 'scenario'),
    ...buildHighlightsFromNotes(dislikeNotes, 'dislike', noteLimit + 2, 'scenario'),
  ];
  const scenarioHighlights = dedupeHighlights(applyScenarioPriority(scenarioHighlightsRaw, noteLimit));

  const stylePatterns = buildStylePatternSummary(metricPatternMap, noteLimit);

  const totalSamples = feedback.length;

  if (
    positiveHighlights.length === 0 &&
    negativeHighlights.length === 0 &&
    scenarioHighlights.length === 0 &&
    (!stylePatterns || (
      stylePatterns.positive.length === 0 &&
      stylePatterns.negative.length === 0 &&
      stylePatterns.mixed.length === 0
    ))
  ) {
    return null;
  }

  const summary: FeedbackSignalSummary = {
    totalSamples,
    positiveHighlights,
    negativeHighlights,
  };

  if (scenarioHighlights.length > 0) {
    summary.scenarioHighlights = scenarioHighlights;
  }

  if (stylePatterns) {
    summary.stylePatterns = stylePatterns;
  }

  return summary;
}

function recordCondensedNote(notes: Map<string, NoteAccumulator>, note: string, classification: NoteClassification) {
  const { key, phrase } = createNoteSignature(note);
  let accumulator = notes.get(key);
  if (!accumulator) {
    accumulator = {
      key,
      phrase,
      count: 0,
      classification,
    };
    notes.set(key, accumulator);
  } else {
    if (phrase.length > 0 && phrase.length < accumulator.phrase.length) {
      accumulator.phrase = phrase;
    }
    accumulator.classification = mergeClassification(accumulator.classification, classification);
  }
  accumulator.count += 1;
}

function mergeClassification(existing: NoteClassification, next: NoteClassification): NoteClassification {
  if (existing === 'scenario' || next === 'scenario') {
    return 'scenario';
  }
  return 'aesthetic';
}

function buildHighlightsFromNotes(
  notes: Map<string, NoteAccumulator>,
  sentiment: 'like' | 'dislike',
  limit: number,
  classificationFilter?: NoteClassification
): string[] {
  if (notes.size === 0 || limit <= 0) {
    return [];
  }

  return Array.from(notes.values())
    .filter(accumulator => !classificationFilter || accumulator.classification === classificationFilter)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map(accumulator => formatHighlightSnippet(accumulator.phrase, sentiment, accumulator.count));
}

function formatHighlightSnippet(phrase: string, sentiment: 'like' | 'dislike', count: number): string {
  const prefix = sentiment === 'like' ? 'Likes' : 'Dislikes';
  const sanitized = normalizeWhitespace(phrase);
  return `${prefix} ×${count}: ${sanitized}`;
}

function harmonizeHighlight(value: string, sentiment: 'like' | 'dislike'): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const likesMatch = trimmed.match(/^(\d+)\s*(likes|liked|like):\s*(.+)$/i);
  if (likesMatch) {
    return formatHighlightSnippet(likesMatch[3], 'like', Number(likesMatch[1]) || 1);
  }

  const dislikesMatch = trimmed.match(/^(\d+)\s*(dislikes|disliked|dislike|doesn't like):\s*(.+)$/i);
  if (dislikesMatch) {
    return formatHighlightSnippet(dislikesMatch[3], 'dislike', Number(dislikesMatch[1]) || 1);
  }

  const likesSymbolMatch = trimmed.match(/^(likes|loves|enjoys)\b[:\s-]*(.+)$/i);
  if (likesSymbolMatch) {
    return formatHighlightSnippet(likesSymbolMatch[2], 'like', 1);
  }

  const dislikesSymbolMatch = trimmed.match(/^(dislikes|hates|avoids)\b[:\s-]*(.+)$/i);
  if (dislikesSymbolMatch) {
    return formatHighlightSnippet(dislikesSymbolMatch[2], 'dislike', 1);
  }

  return formatHighlightSnippet(trimmed, sentiment, 1);
}

function stripHighlightPrefix(highlight: string): string {
  return highlight.replace(/^(likes|dislikes)\s*×?\d*[:\s-]*/i, '').trim();
}

function classifyFeedbackEntry(entry: OutfitFeedback): NoteClassification {
  const note = normalizeWhitespace(entry.feedback ?? '');
  if (!note) {
    return 'aesthetic';
  }

  if (containsAestheticKeyword(note)) {
    return 'aesthetic';
  }

  const context = extractContextText(entry);
  if (!context) {
    return 'aesthetic';
  }

  if (containsAestheticKeyword(context) && AESTHETIC_STYLE_KEYWORDS.some(keyword => note.toLowerCase().includes(keyword))) {
    return 'aesthetic';
  }

  return isScenarioComment(note, context) ? 'scenario' : 'aesthetic';
}

function extractContextText(entry: OutfitFeedback): string {
  const parts: string[] = [];
  if (entry.prompt) {
    parts.push(entry.prompt);
  }
  if (entry.outfit?.prompt) {
    parts.push(entry.outfit.prompt);
  }
  if (entry.outfit?.notes) {
    parts.push(entry.outfit.notes);
  }
  return normalizeWhitespace(parts.join(' '));
}

function isScenarioComment(note: string, context: string): boolean {
  const lowerNote = note.toLowerCase();
  const lowerContext = context.toLowerCase();

  if (AESTHETIC_STYLE_KEYWORDS.some(keyword => lowerNote.includes(keyword))) {
    return false;
  }

  if (SCENARIO_EVENT_KEYWORDS.some(keyword => lowerNote.includes(keyword) || lowerContext.includes(keyword))) {
    return true;
  }

  const hasDirective = SCENARIO_DIRECTIVE_KEYWORDS.some(keyword => lowerNote.includes(keyword));

  const noteTokens = extractScenarioTokens(lowerNote);
  const contextTokens = extractScenarioTokens(lowerContext);

  let shared = 0;
  noteTokens.forEach(token => {
    if (contextTokens.has(token)) {
      shared += 1;
    }
  });

  if (shared >= 2) {
    return true;
  }

  if (hasDirective && shared >= 1) {
    return true;
  }

  return false;
}

function extractScenarioTokens(value: string): Set<string> {
  const tokens = value
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !NOTE_KEY_STOPWORDS.has(token));
  return new Set(tokens);
}

function containsAestheticKeyword(value: string): boolean {
  const lower = value.toLowerCase();
  return AESTHETIC_STYLE_KEYWORDS.some(keyword => lower.includes(keyword));
}

function createNoteSignature(note: string): { key: string; phrase: string } {
  const trimmed = normalizeWhitespace(note);
  const lowered = trimmed.toLowerCase();
  const cleaned = lowered.replace(/[^a-z0-9\s]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const keywords: string[] = [];
  for (const token of tokens) {
    if (NOTE_KEY_STOPWORDS.has(token) || token.length <= 2) {
      continue;
    }
    if (!keywords.includes(token)) {
      keywords.push(token);
    }
    if (keywords.length >= 6) {
      break;
    }
  }

  const keyTokens = keywords.slice(0, 4);
  const key = keyTokens.length > 0 ? keyTokens.join('|') : lowered.slice(0, 80);
  const phrase = truncateWords(trimmed, 10, 80);

  return { key, phrase };
}

function truncateWords(value: string, maxWords: number, maxChars: number): string {
  const words = value.split(/\s+/).filter(Boolean).slice(0, maxWords);
  let result = words.join(' ');
  if (result.length > maxChars) {
    result = result.slice(0, maxChars).trimEnd();
  }
  return result;
}

function recordMetricPattern(
  store: Map<string, MetricAccumulator>,
  metric: string,
  bucket: string,
  entry: OutfitFeedback,
  classification: NoteClassification
): void {
  if (!bucket) {
    return;
  }
  const key = `${metric}::${bucket}`;
  let accumulator = store.get(key);
  if (!accumulator) {
    accumulator = {
      metric,
      bucket,
      likeCount: 0,
      dislikeCount: 0,
      likeNotes: new Map<string, NoteAccumulator>(),
      dislikeNotes: new Map<string, NoteAccumulator>(),
    };
    store.set(key, accumulator);
  }

  if (entry.type === 'like') {
    accumulator.likeCount += 1;
    if (entry.feedback) {
      const note = entry.feedback.trim();
      if (note.length > 0) {
        recordCondensedNote(accumulator.likeNotes, note, classification);
      }
    }
  } else {
    accumulator.dislikeCount += 1;
    if (entry.feedback) {
      const note = entry.feedback.trim();
      if (note.length > 0) {
        recordCondensedNote(accumulator.dislikeNotes, note, classification);
      }
    }
  }
}

function buildStylePatternSummary(
  store: Map<string, MetricAccumulator>,
  noteLimit: number
): FeedbackStylePatternSummary | undefined {
  if (store.size === 0) {
    return undefined;
  }

  const patterns = Array.from(store.values())
    .map(accumulator => {
      const total = accumulator.likeCount + accumulator.dislikeCount;
      if (total < MIN_PATTERN_SAMPLE_COUNT) {
        return null;
      }
      const likeRatio = total > 0 ? accumulator.likeCount / total : 0;
      const summary = formatPatternSummary(accumulator, likeRatio, noteLimit);
      return summary ? { ...summary, likeRatio } : null;
    })
    .filter((entry): entry is { summary: string; likeRatio: number; score: number } => entry !== null)
    .map(entry => ({ ...entry, score: entry.likeRatio }));

  if (patterns.length === 0) {
    return undefined;
  }

  const selectSummaries = (
    comparator: (ratio: number) => boolean
  ): string[] => {
    const seen = new Set<string>();
    return patterns
      .filter(item => comparator(item.likeRatio))
      .sort((a, b) => b.score - a.score)
      .map(item => item.summary)
      .filter(summary => {
        const normalized = summary.toLowerCase();
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      })
      .slice(0, DEFAULT_STYLE_PATTERN_LIMIT);
  };

  const positive = selectSummaries(ratio => ratio >= POSITIVE_RATIO_THRESHOLD);
  const negative = selectSummaries(ratio => ratio <= NEGATIVE_RATIO_THRESHOLD);
  const mixed = selectSummaries(ratio => ratio > NEGATIVE_RATIO_THRESHOLD && ratio < POSITIVE_RATIO_THRESHOLD);

  if (positive.length === 0 && negative.length === 0 && mixed.length === 0) {
    return undefined;
  }

  return { positive, negative, mixed };
}

function formatPatternSummary(
  accumulator: MetricAccumulator,
  likeRatio: number,
  noteLimit: number
): { summary: string; likeRatio: number; score: number } | null {
  const label = formatMetricLabel(accumulator.metric, accumulator.bucket);
  const total = accumulator.likeCount + accumulator.dislikeCount;
  const ratioText = total > 0 ? `${accumulator.likeCount}/${total} likes (${Math.round(likeRatio * 100)}%)` : '';
  const highlightLimit = Math.max(1, Math.min(noteLimit, 2));
  const aestheticHighlights = collectRepresentativeHighlights(accumulator, highlightLimit, 'aesthetic');
  const scenarioHighlights = collectRepresentativeHighlights(accumulator, 1, 'scenario');

  const bestHighlight = aestheticHighlights[0] ?? scenarioHighlights[0];
  if (scenarioHighlights[0] && !aestheticHighlights[0]) {
    // Scenario-only signals get a lower weight so they appear, but later in the list
    const summaryParts = [label, ratioText, `Context note: ${stripHighlightPrefix(scenarioHighlights[0])}`].filter(Boolean);
    return {
      summary: summaryParts.join(' — '),
      likeRatio,
      score: likeRatio - 0.1,
    };
  }

  const summaryParts = [label, ratioText, bestHighlight ? `Note: ${stripHighlightPrefix(bestHighlight)}` : undefined].filter(Boolean);
  return {
    summary: summaryParts.join(' — '),
    likeRatio,
    score: likeRatio,
  };
}

function collectRepresentativeHighlights(
  accumulator: MetricAccumulator,
  limit: number,
  classificationFilter: NoteClassification = 'aesthetic'
): string[] {
  const normalizedLimit = Math.max(1, limit);
  const highlights: string[] = [];

  const primarySentiment: 'like' | 'dislike' = accumulator.likeCount >= accumulator.dislikeCount ? 'like' : 'dislike';
  const primaryNotes = primarySentiment === 'like' ? accumulator.likeNotes : accumulator.dislikeNotes;
  const secondaryNotes = primarySentiment === 'like' ? accumulator.dislikeNotes : accumulator.likeNotes;

  highlights.push(
    ...buildHighlightsFromNotes(primaryNotes, primarySentiment, normalizedLimit, classificationFilter)
  );

  if (highlights.length < normalizedLimit) {
    const remaining = normalizedLimit - highlights.length;
    const secondarySentiment: 'like' | 'dislike' = primarySentiment === 'like' ? 'dislike' : 'like';
    highlights.push(
      ...buildHighlightsFromNotes(secondaryNotes, secondarySentiment, remaining, classificationFilter)
    );
  }

  return dedupeHighlights(highlights.slice(0, normalizedLimit));
}

function formatMetricLabel(metric: string, bucket: string): string {
  const cleanedBucket = bucket.trim();
  switch (metric) {
    case 'fit_profile': {
      const parts = cleanedBucket.split('_');
      if (parts.length === 2) {
        return `Fit: ${parts[0]} top + ${parts[1]} bottom`.replace(/_/g, ' ');
      }
      return `Fit: ${cleanedBucket.replace(/_/g, ' ')}`;
    }
    case 'overall_shape':
      return `Silhouette: ${cleanedBucket.replace(/_/g, ' ')}`;
    case 'volume_distribution':
      return `Volume balance: ${cleanedBucket}`;
    case 'dominant_line':
      return `Lines: ${cleanedBucket.replace(/_/g, ' ')}`;
    case 'color_count':
      return `Color count: ${cleanedBucket}`;
    case 'color_experimentation':
      return `Color play: ${cleanedBucket}`;
    case 'pattern_count':
      return `Patterns: ${cleanedBucket}`;
    default:
      return `${metric.replace(/_/g, ' ')}: ${cleanedBucket}`;
  }
}

function resolveEntryStyleMetrics(entry: OutfitFeedback): StyleMetrics | null {
  if (entry.styleMetrics) {
    return entry.styleMetrics;
  }
  if (entry.outfit?.styleMetrics) {
    return entry.outfit.styleMetrics;
  }
  return null;
}

function bucketVolumeDistribution(
  volume: StyleMetrics['volumeDistribution'] | undefined | null
): string | null {
  if (!volume || typeof volume.top !== 'number' || typeof volume.bottom !== 'number') {
    return null;
  }
  const diff = volume.top - volume.bottom;
  if (diff >= 0.15) {
    return 'top focus';
  }
  if (diff <= -0.15) {
    return 'bottom focus';
  }
  return 'balanced';
}

function bucketColorExperimentation(index: number | undefined | null): string | null {
  if (typeof index !== 'number' || Number.isNaN(index)) {
    return null;
  }
  if (index < 0.3) {
    return 'low experimentation';
  }
  if (index < 0.6) {
    return 'moderate experimentation';
  }
  return 'high experimentation';
}

function bucketColorCount(count: number | undefined | null): string | null {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return null;
  }
  if (count <= 2) {
    return '1-2 colors';
  }
  if (count <= 4) {
    return '3-4 colors';
  }
  return '5+ colors';
}

function bucketPatternCount(count: number | undefined | null): string | null {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return null;
  }
  if (count === 0) {
    return 'no patterns';
  }
  if (count === 1) {
    return 'single pattern';
  }
  return 'multiple patterns';
}

export interface ItemTrait {
  id?: string;
  canonicalTitle: string;
  keywords: string[];
  traitTokens: string[];
  category?: string;
}

export function createItemTraitResolver(
  items: ItemTraitSource[],
  normalizeTitleKey: (title: string) => string
): (title: string, id?: string) => ItemTrait | null {
  const byId = new Map<string, ItemTrait>();
  const byTitle = new Map<string, ItemTrait>();

  items.forEach(item => {
    const trait: ItemTrait = {
      id: item.id,
      canonicalTitle: item.title,
      keywords: buildKeywordList(item),
      traitTokens: buildTraitTokens(item),
      category: item.category,
    };
    if (item.id) {
      byId.set(item.id, trait);
    }
    const key = normalizeTitleKey(item.title);
    if (key) {
      byTitle.set(key, trait);
    }
  });

  return (title: string, id?: string) => {
    if (id && byId.has(id)) {
      return byId.get(id) ?? null;
    }
    const key = normalizeTitleKey(title);
    if (!key) {
      return null;
    }
    return byTitle.get(key) ?? null;
  };
}

function buildKeywordList(item: ItemTraitSource): string[] {
  const keywords = new Set<string>();
  keywords.add(item.title.toLowerCase());
  if (item.category) {
    keywords.add(item.category.toLowerCase());
  }
  if (item.subCategory) {
    keywords.add(item.subCategory.toLowerCase());
  }
  (item.colors || []).forEach(color => keywords.add(color.toLowerCase()));
  (item.styleTags || []).forEach(tag => keywords.add(tag.toLowerCase()));
  return Array.from(keywords);
}

function buildTraitTokens(item: ItemTraitSource): string[] {
  const tokens: string[] = [];
  if (item.category) {
    tokens.push(`category:${item.category.toLowerCase()}`);
  }
  if (item.subCategory) {
    tokens.push(`subcategory:${item.subCategory.toLowerCase()}`);
  }
  (item.colors || []).forEach(color => tokens.push(`color:${color.toLowerCase()}`));
  (item.styleTags || []).forEach(tag => tokens.push(`style:${tag.toLowerCase()}`));
  return tokens;
}

function applyScenarioPriority(highlights: string[], limit: number): string[] {
  if (highlights.length <= limit) {
    return highlights.slice(0, limit);
  }

  const directiveHighlights = highlights.filter(isDirectiveScenarioHighlight);
  const topDirective = directiveHighlights.length > 0 ? directiveHighlights[0] : null;

  const rest = highlights.filter(highlight => highlight !== topDirective);
  const result: string[] = [];

  if (topDirective) {
    result.push(topDirective);
  }

  rest.forEach(highlight => {
    if (result.length < limit) {
      result.push(highlight);
    }
  });

  return result.slice(0, limit);
}

function isDirectiveScenarioHighlight(highlight: string): boolean {
  const lower = highlight.toLowerCase();
  return (
    /dislikes/.test(lower) &&
    SCENARIO_DIRECTIVE_KEYWORDS.some(keyword => lower.includes(keyword))
  );
}
