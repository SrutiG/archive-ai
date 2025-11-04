/**
 * Maps wardrobe item categories to placeholder images in the static folder
 */
export const getPlaceholderImage = (category: string): string => {
  const categoryMap: Record<string, string> = {
    'Tops': '/static/placeholder-women-tops-short-sleeve-crop.png',
    'Bottoms': '/static/placeholder-women-bottoms-pants.png',
    'Dresses': '/static/placeholder-women-bottoms-pants.png', // Using bottoms as fallback
    'Outerwear': '/static/placeholder-women-outerwear-blazer.png',
    'Shoes': '/static/placeholder-women-shoes-pumps.png',
    'Accessories': '/static/placeholder-women-accessories-jewelry-necklace-pendant.png',
    'Jewelry': '/static/placeholder-women-accessories-jewelry-necklace-pendant.png',
    'Bags': '/static/placeholder-women-accessories-bag.png',
    'Activewear': '/static/placeholder-women-tops-short-sleeve-crop.png', // Using tops as fallback
    'Underwear': '/static/placeholder-women-tops-short-sleeve-crop.png', // Using tops as fallback
  };

  return categoryMap[category] || '/static/placeholder-women-tops-short-sleeve-crop.png'; // Default fallback
};

/**
 * Gets the image URL for a wardrobe item, using placeholder if imageUrl is missing
 */
export const getItemImageUrl = (item: { imageUrl?: string; category: string }, apiUrl: string): string => {
  if (item.imageUrl) {
    return `${apiUrl}${item.imageUrl}`;
  }
  return getPlaceholderImage(item.category);
};

