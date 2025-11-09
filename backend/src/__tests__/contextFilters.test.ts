import { extractContextFilters, filterItemsForContext } from '../llmService';
import { WardrobeItem } from '../index';

const buildItem = (overrides: Partial<WardrobeItem>): WardrobeItem => ({
  id: overrides.id || `item-${Math.random().toString(36).slice(2, 8)}`,
  title: overrides.title || 'Sample Item',
  category: overrides.category || 'Tops',
  createdAt: overrides.createdAt || new Date().toISOString(),
  ...overrides,
});

describe('extractContextFilters', () => {
  it('identifies formality, occasion, and seasonal cues from prompt', () => {
    const filters = extractContextFilters('Casual family lunch when it is about 45 degrees outside');
    expect(filters.formalities.has('casual')).toBe(true);
    expect(filters.occasions.has('family')).toBe(true);
    expect(filters.seasons.has('winter')).toBe(true);
    expect(filters.temperatureNotes).toContain('45°F');
  });

  it('collects style tags when mentioned', () => {
    const filters = extractContextFilters('Looking for an edgy streetwear inspired outfit');
    expect(filters.styleTags.has('edgy')).toBe(true);
    expect(filters.styleTags.has('streetwear')).toBe(true);
  });
});

describe('filterItemsForContext', () => {
  const casualTop = buildItem({
    id: 'casual-top',
    title: 'Casual Linen Shirt',
    category: 'Tops',
    formalities: ['casual'],
    seasons: ['spring', 'fall'],
  });

  const formalTop = buildItem({
    id: 'formal-top',
    title: 'Formal Silk Blouse',
    category: 'Tops',
    formalities: ['formal'],
    seasons: ['winter'],
  });

  const unspecifiedTop = buildItem({
    id: 'unspecified-top',
    title: 'Unknown Formality Tee',
    category: 'Tops',
  });

  const minimalistTop = buildItem({
    id: 'minimalist-top',
    title: 'Minimalist Black Tee',
    category: 'Tops',
    styleTags: ['minimalist'],
    formalities: ['formal'],
    seasons: ['winter'],
  });

  it('filters out items with conflicting attributes while keeping unspecified ones', () => {
    const contextFilters = extractContextFilters('casual lunch in cool weather');
    const { filteredItems } = filterItemsForContext(
      [casualTop, formalTop, unspecifiedTop],
      contextFilters,
      []
    );

    const ids = filteredItems.map(item => item.id);
    expect(ids).toContain('casual-top');
    expect(ids).toContain('unspecified-top');
    expect(ids).not.toContain('formal-top');
  });

  it('retains selected items even when they conflict with filters', () => {
    const contextFilters = extractContextFilters('casual lunch in cool weather');
    const { filteredItems } = filterItemsForContext(
      [casualTop, formalTop],
      contextFilters,
      [formalTop]
    );

    const ids = filteredItems.map(item => item.id);
    expect(ids).toContain('formal-top');
    expect(ids).toContain('casual-top');
  });

  it('never filters out minimalist or classic style tags', () => {
    const contextFilters = extractContextFilters('casual lunch in cool weather');
    const { filteredItems } = filterItemsForContext(
      [minimalistTop],
      contextFilters,
      []
    );

    const ids = filteredItems.map(item => item.id);
    expect(ids).toContain('minimalist-top');
  });
});

