import { WardrobeItem } from '../App';

export interface MissingFieldInfo {
  item: WardrobeItem;
  missingFields: string[];
}

// Check if an item has a neckline (for tops)
function hasNeckline(item: WardrobeItem): boolean {
  if (item.category !== 'Tops' && item.category !== 'Outerwear') {
    return true; // Not required for other categories
  }
  
  const necklineKeywords = [
    'v-neck', 'boat-neck', 'mock-neck', 'turtleneck', 'crew-neck',
    'scoop-neck', 'scoop', 'square-neck', 'sweetheart', 'off-the-shoulder',
    'halter-neck', 'cowl-neck', 'hooded', 'collared', 'collarless', 'lapel'
  ];
  
  const silhouettes = item.silhouettes || (item.silhouette ? [item.silhouette] : []);
  return silhouettes.some(s => necklineKeywords.includes(s));
}

// Check if an item has a length (for bottoms)
function hasLength(item: WardrobeItem): boolean {
  if (item.category !== 'Bottoms') {
    return true; // Not required for other categories
  }
  
  const lengthKeywords = [
    'cropped', 'ankle-length', 'full-length', 'capri', '7/8-length',
    '3/4-length', 'mini', 'midi', 'maxi', 'tea-length', 'floor-length'
  ];
  
  const silhouettes = item.silhouettes || (item.silhouette ? [item.silhouette] : []);
  return silhouettes.some(s => lengthKeywords.includes(s));
}

// Check if an item has a rise (for bottoms)
function hasRise(item: WardrobeItem): boolean {
  if (item.category !== 'Bottoms') {
    return true; // Not required for other categories
  }
  
  const riseKeywords = ['high-rise', 'mid-rise', 'low-rise'];
  
  const silhouettes = item.silhouettes || (item.silhouette ? [item.silhouette] : []);
  return silhouettes.some(s => riseKeywords.includes(s));
}

// Check if an item has a length (for tops/outerwear)
function hasTopLength(item: WardrobeItem): boolean {
  if (item.category !== 'Tops' && item.category !== 'Outerwear') {
    return true; // Not required for other categories
  }
  
  // Bodysuits don't need length - they're one-piece garments
  const isBodysuit = item.title.toLowerCase().includes('bodysuit') ||
                     item.subCategory?.toLowerCase().includes('bodysuit');
  if (isBodysuit) {
    return true; // Not required for bodysuits
  }
  
  const lengthKeywords = [
    'cropped', 'hip-length', 'mid-thigh', 'waist-length', 'knee-length', 'long'
  ];
  
  const silhouettes = item.silhouettes || (item.silhouette ? [item.silhouette] : []);
  return silhouettes.some(s => lengthKeywords.includes(s));
}

export function checkMissingFields(items: WardrobeItem[]): MissingFieldInfo[] {
  const missing: MissingFieldInfo[] = [];
  
  items.forEach(item => {
    const missingFields: string[] = [];
    
    // Every item should have a color
    if (!item.colors || item.colors.length === 0) {
      missingFields.push('color');
    }
    
    // Tops and Outerwear should have a neckline
    if (!hasNeckline(item)) {
      missingFields.push('neckline');
    }
    
    // Tops and Outerwear should have a length
    if (!hasTopLength(item)) {
      missingFields.push('length');
    }
    
    // Bottoms should have a length
    if (!hasLength(item)) {
      missingFields.push('length');
    }
    
    // Bottoms should have a rise
    if (!hasRise(item)) {
      missingFields.push('rise');
    }
    
    if (missingFields.length > 0) {
      missing.push({ item, missingFields });
    }
  });
  
  return missing;
}

export function getMissingFieldsSummary(missing: MissingFieldInfo[]): string {
  if (missing.length === 0) {
    return '';
  }
  
  const counts: Record<string, number> = {};
  missing.forEach(({ missingFields }) => {
    missingFields.forEach(field => {
      counts[field] = (counts[field] || 0) + 1;
    });
  });
  
  const parts: string[] = [];
  if (counts.color) parts.push(`${counts.color} missing color${counts.color > 1 ? 's' : ''}`);
  if (counts.neckline) parts.push(`${counts.neckline} missing neckline${counts.neckline > 1 ? 's' : ''}`);
  if (counts.length) parts.push(`${counts.length} missing length${counts.length > 1 ? 's' : ''}`);
  if (counts.rise) parts.push(`${counts.rise} missing rise${counts.rise > 1 ? 's' : ''}`);
  
  return parts.join(', ');
}

