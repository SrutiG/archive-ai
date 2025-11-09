import { __test__ } from '../llmService';
import { WardrobeItem } from '../index';

describe('LLM anchor selection utilities', () => {
  const buildItem = (id: string, title: string, category: string): WardrobeItem => ({
    id,
    title,
    category,
    createdAt: new Date().toISOString(),
  });

  it('selectAnchorItems returns deterministic anchors for a given seed', () => {
    const itemsByCategory: Record<string, WardrobeItem[]> = {
      Tops: [buildItem('top-1', 'Black Turtleneck', 'Tops'), buildItem('top-2', 'Ivory Silk Blouse', 'Tops')],
      Bottoms: [buildItem('bottom-1', 'Wide Leg Trousers', 'Bottoms')],
      Shoes: [buildItem('shoe-1', 'Chelsea Boots', 'Shoes')],
      Accessories: [buildItem('acc-1', 'Gold Hoop Earrings', 'Accessories')],
      Swimwear: [buildItem('swim-1', 'Navy One Piece', 'Swimwear')],
    };

    const first = __test__.selectAnchorItems(itemsByCategory, 4, 13_500);
    const second = __test__.selectAnchorItems(itemsByCategory, 4, 13_500);

    expect(first).toHaveLength(4);
    expect(second.map(anchor => anchor.anchorItem.id)).toEqual(first.map(anchor => anchor.anchorItem.id));

    first.forEach(anchor => {
      expect(itemsByCategory[anchor.category]).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: anchor.anchorItem.id })])
      );
    });

    const uniqueIds = new Set(first.map(anchor => anchor.anchorItem.id));
    expect(uniqueIds.size).toBe(first.length);
  });

  it('lower-weighted categories are selected less frequently across seeds', () => {
    const itemsByCategory: Record<string, WardrobeItem[]> = {
      Tops: [buildItem('top-1', 'Black Turtleneck', 'Tops')],
      Bottoms: [buildItem('bottom-1', 'Wide Leg Trousers', 'Bottoms')],
      Swimwear: [buildItem('swim-1', 'Navy One Piece', 'Swimwear')],
    };

    const counts: Record<string, number> = { Tops: 0, Bottoms: 0, Swimwear: 0 };

    for (let seed = 1; seed <= 40; seed += 1) {
      const anchors = __test__.selectAnchorItems(itemsByCategory, 3, seed);
      anchors.forEach(anchor => {
        counts[anchor.category] = (counts[anchor.category] || 0) + 1;
      });
    }

    expect(counts.Tops).toBeGreaterThan(counts.Swimwear);
    expect(counts.Bottoms).toBeGreaterThan(counts.Swimwear);
  });

  it('generateFallbackOutfits always includes provided anchor items', () => {
    const top = buildItem('top-1', 'Black Turtleneck', 'Tops');
    const bottom = buildItem('bottom-1', 'Wide Leg Trousers', 'Bottoms');
    const shoe = buildItem('shoe-1', 'Chelsea Boots', 'Shoes');
    const accessory = buildItem('acc-1', 'Gold Hoop Earrings', 'Accessories');

    const itemsByCoreCategory = {
      tops: [top],
      bottoms: [bottom],
      shoes: [shoe],
      accessories: [accessory],
    };

    const allItemsMap = new Map<string, WardrobeItem>([
      [top.title.toLowerCase(), top],
      [bottom.title.toLowerCase(), bottom],
      [shoe.title.toLowerCase(), shoe],
      [accessory.title.toLowerCase(), accessory],
    ]);

    const outfits = __test__.generateFallbackOutfits(
      itemsByCoreCategory,
      ['tops', 'bottoms', 'shoes', 'accessories'],
      allItemsMap,
      {
        normalizeTitleKey: title => title.toLowerCase(),
        shouldAvoidTitle: () => false,
        selectedItems: [],
        anchorItems: [top, bottom, shoe],
      },
      3
    );

    expect(outfits).toHaveLength(3);
    expect(outfits[0].items).toContain(top.title);
    expect(outfits[1].items).toContain(bottom.title);
    expect(outfits[2].items).toContain(shoe.title);
  });
});

