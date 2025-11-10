import { __test__ } from '../llmService';
import { AdminOutfitItemSummary } from '../adminTypes';

const { buildAdminOutfitSummary, parseEvaluationResponse } = __test__;
const { assessOutfitStructure } = __test__;

describe('Admin outfit evaluation helpers', () => {
  const baseItems: AdminOutfitItemSummary[] = [
    {
      id: 'item-1',
      title: 'Dries Van Noten Shell Coat',
      category: 'Outerwear',
      subCategory: 'Coat',
      brand: 'Dries Van Noten',
      colors: ['olive', 'black'],
      silhouettes: ['cocoon'],
      pattern: 'abstract',
      fit: 'relaxed',
      formalities: ['smart-casual'],
      styleTags: ['modern', 'minimalist'],
      seasons: ['fall', 'winter'],
      occasions: ['work'],
    },
    {
      id: 'item-2',
      title: 'The Row High-Waist Trousers',
      category: 'Bottoms',
      subCategory: 'Pants',
      brand: 'The Row',
      colors: ['charcoal'],
      silhouettes: ['wide-leg'],
      fit: 'tailored',
      formalities: ['business-formal'],
    },
  ];

  const sampleCandidate = {
    id: 'outfit-1',
    itemIds: baseItems.map(item => item.id),
    itemTitles: baseItems.map(item => item.title),
    items: baseItems,
    justification: 'Balances sculptural outerwear with clean tailoring.',
    stylingSuggestions: ['Consider a tonal knit underneath for warmth.'],
    prompt: 'Boardroom review in late autumn',
  };

  it('buildAdminOutfitSummary includes attributes and prompt context', () => {
    const summary = buildAdminOutfitSummary(sampleCandidate);

    expect(summary).toContain('Dries Van Noten Shell Coat');
    expect(summary).toContain('Colors: olive, black');
    expect(summary).toContain('Silhouettes: cocoon');
    expect(summary).toContain('Why it works (model): Balances sculptural outerwear');
    expect(summary).toContain('Styling prompts: Consider a tonal knit underneath for warmth.');
    expect(summary).toContain('User prompt/context: Boardroom review in late autumn');
  });

  it('assessOutfitStructure flags swimwear conflicts', () => {
    const swimCandidate = {
      ...sampleCandidate,
      items: [
        ...baseItems,
        {
          id: 'item-3',
          title: 'Hunza G Crinkle One-Piece',
          category: 'Swimwear',
        },
      ],
    };

    const structure = assessOutfitStructure(swimCandidate);
    expect(structure.ok).toBe(false);
    expect(structure.issues.some(issue => issue.toLowerCase().includes('swimwear'))).toBe(true);
  });

  it('parseEvaluationResponse reads triage metadata correctly', () => {
    const payload = JSON.stringify({
      evaluations: [
        {
          outfitId: 'outfit-1',
          score: 4,
          confidence: 8,
          verdict: 'dislike',
          filteredByTriage: true,
          notes: 'Missing shoes and feels incomplete.',
        },
      ],
    });

    const rows = parseEvaluationResponse(payload, 'triage');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      outfitId: 'outfit-1',
      score: 4,
      confidence: 8,
      verdict: 'dislike',
      filteredByTriage: true,
      notes: 'Missing shoes and feels incomplete.',
    });
  });

  it('parseEvaluationResponse keeps final-stage rationale', () => {
    const payload = JSON.stringify({
      evaluations: [
        {
          outfitId: 'outfit-1',
          score: 10,
          confidence: 9,
          verdict: 'like',
          rationale: 'Strong balance of color, proportion, and context readiness.',
          notes: 'Anchor coat styled impeccably.',
        },
      ],
    });

    const rows = parseEvaluationResponse(payload, 'final');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      outfitId: 'outfit-1',
      score: 10,
      confidence: 9,
      verdict: 'like',
      rationale: 'Strong balance of color, proportion, and context readiness.',
      notes: 'Anchor coat styled impeccably.',
    });
  });

  it('parseEvaluationResponse gracefully handles malformed payloads', () => {
    expect(parseEvaluationResponse('{"unexpected":42}', 'triage')).toHaveLength(0);
    expect(parseEvaluationResponse('not-json', 'triage')).toHaveLength(0);
    expect(parseEvaluationResponse(undefined, 'final')).toHaveLength(0);
  });
});


