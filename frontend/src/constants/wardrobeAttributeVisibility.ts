export type WardrobeAttributeId =
  | 'colors'
  | 'fabrics'
  | 'pattern'
  | 'silhouettes'
  | 'fit'
  | 'formalities'
  | 'styleTags'
  | 'seasons'
  | 'occasions'
  | 'brand'
  | 'careNotes';

const APPAREL_WITH_SILHOUETTE: WardrobeAttributeId[] = [
  'colors',
  'fabrics',
  'pattern',
  'silhouettes',
  'fit',
  'formalities',
  'styleTags',
  'seasons',
  'occasions',
  'brand',
  'careNotes',
];

const FOOTWEAR_ATTRIBUTES: WardrobeAttributeId[] = [
  'colors',
  'fabrics',
  'pattern',
  'styleTags',
  'formalities',
  'seasons',
  'occasions',
  'brand',
  'careNotes',
];

const ACCESSORY_ATTRIBUTES: WardrobeAttributeId[] = [
  'colors',
  'fabrics',
  'pattern',
  'styleTags',
  'seasons',
  'occasions',
  'brand',
  'careNotes',
];

const JEWELRY_ATTRIBUTES: WardrobeAttributeId[] = [
  'colors',
  'styleTags',
  'occasions',
  'brand',
  'careNotes',
];

const CATEGORY_ATTRIBUTE_VISIBILITY: Record<string, WardrobeAttributeId[]> = {
  Tops: APPAREL_WITH_SILHOUETTE,
  Bottoms: APPAREL_WITH_SILHOUETTE,
  Dresses: APPAREL_WITH_SILHOUETTE,
  Outerwear: APPAREL_WITH_SILHOUETTE,
  'Dresses & One-Pieces': APPAREL_WITH_SILHOUETTE,
  'Underwear & Sleepwear': APPAREL_WITH_SILHOUETTE,
  Swimwear: APPAREL_WITH_SILHOUETTE,
  Activewear: APPAREL_WITH_SILHOUETTE,
  Shoes: FOOTWEAR_ATTRIBUTES,
  Accessories: ACCESSORY_ATTRIBUTES,
  Bags: ACCESSORY_ATTRIBUTES,
  Jewelry: JEWELRY_ATTRIBUTES,
  default: APPAREL_WITH_SILHOUETTE,
};

export function getVisibleAttributes(
  category?: string,
  subCategory?: string
): WardrobeAttributeId[] {
  if (category) {
    const trimmed = category.trim();
    if (trimmed && CATEGORY_ATTRIBUTE_VISIBILITY[trimmed]) {
      return [...CATEGORY_ATTRIBUTE_VISIBILITY[trimmed]];
    }
  }

  if (subCategory) {
    const trimmed = subCategory.trim();
    if (trimmed && CATEGORY_ATTRIBUTE_VISIBILITY[trimmed]) {
      return [...CATEGORY_ATTRIBUTE_VISIBILITY[trimmed]];
    }
  }

  return [...CATEGORY_ATTRIBUTE_VISIBILITY.default];
}

