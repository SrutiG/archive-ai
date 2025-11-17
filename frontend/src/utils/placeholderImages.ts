// Cache for stock photo URLs to avoid repeated API calls
const stockPhotoCache: Record<string, string> = {};

/**
 * Fetches a stock photo URL from the API for a given category and optional subcategory
 * Returns null only on network errors or if the stock photo doesn't exist
 */
async function fetchStockPhotoUrl(category: string, subcategory?: string, apiUrl?: string): Promise<string | null> {
  const cacheKey = subcategory ? `${category}:${subcategory}` : category;
  
  // Check cache first
  if (stockPhotoCache[cacheKey]) {
    return stockPhotoCache[cacheKey];
  }

  try {
    const baseUrl = apiUrl || '';
    const url = subcategory 
      ? `${baseUrl}/api/stock-photo/${encodeURIComponent(category)}?subcategory=${encodeURIComponent(subcategory)}`
      : `${baseUrl}/api/stock-photo/${encodeURIComponent(category)}`;
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // 404 means stock photo doesn't exist - that's okay, return null
      if (response.status === 404) {
        console.debug(`Stock photo not found for ${category}${subcategory ? `/${subcategory}` : ''} (404)`);
        return null;
      }
      // Other errors (500, 503, etc.) - log but don't treat as network error
      console.warn(`Stock photo API error for ${category}${subcategory ? `/${subcategory}` : ''}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    if (data.url) {
      stockPhotoCache[cacheKey] = data.url;
      return data.url;
    }
    
    // No URL in response
    console.warn(`Stock photo API returned no URL for ${category}${subcategory ? `/${subcategory}` : ''}`);
    return null;
  } catch (error) {
    // Network errors, timeouts, CORS issues, etc.
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`Stock photo fetch timeout for ${category}${subcategory ? `/${subcategory}` : ''}`);
    } else {
      console.warn(`Network error fetching stock photo for ${category}${subcategory ? `/${subcategory}` : ''}:`, error);
    }
    return null;
  }
}

/**
 * Maps wardrobe item categories to placeholder images in the static folder
 * This is a fallback when stock photos are not available
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
    'Underwear & Sleepwear': '/static/placeholder-women-tops-short-sleeve-crop.png',
    'Swimwear': '/static/placeholder-women-tops-short-sleeve-crop.png',
  };

  return categoryMap[category] || '/static/placeholder-women-tops-short-sleeve-crop.png'; // Default fallback
};

/**
 * Gets the image URL for a wardrobe item, using stock photo or placeholder if imageUrl is missing
 * This function will try to fetch a stock photo from Supabase, falling back to static placeholders
 * NOTE: Local paths (like /uploads/...) are skipped as they're often broken - we go straight to stock photos
 */
export const getItemImageUrl = async (
  item: { imageUrl?: string; category: string; subCategory?: string; sub_category?: string }, 
  apiUrl: string
): Promise<string> => {
  // Only use imageUrl if it's a valid Supabase URL or external URL
  // Skip local paths (like /uploads/...) as they're often broken (404)
  if (item.imageUrl) {
    // If it's a Supabase URL or external URL, use it directly
    if (item.imageUrl.includes('supabase.co') || 
        item.imageUrl.startsWith('http://') || 
        item.imageUrl.startsWith('https://')) {
      return item.imageUrl;
    }
    // For local paths, skip them and go to stock photo instead
    // Don't return the broken local URL
  }
  
  // Try to fetch stock photo from Supabase
  // Support both subCategory (camelCase) and sub_category (snake_case)
  const subcategory = item.subCategory || item.sub_category;
  const stockPhotoUrl = await fetchStockPhotoUrl(item.category, subcategory, apiUrl);
  if (stockPhotoUrl) {
    console.log(`[Stock Photo] Successfully fetched stock photo for ${item.category}${subcategory ? `/${subcategory}` : ''}`);
    return stockPhotoUrl;
  }
  
  console.warn(`[Stock Photo] Failed to fetch stock photo for ${item.category}${subcategory ? `/${subcategory}` : ''}, using placeholder`);
  // Fallback to static placeholder
  return getPlaceholderImage(item.category);
};

/**
 * Synchronous version that returns immediately (for backwards compatibility)
 * Will use cached stock photos if available, otherwise falls back to static placeholder
 */
export const getItemImageUrlSync = (item: { imageUrl?: string; category: string; subCategory?: string }, apiUrl: string): string => {
  if (item.imageUrl) {
    if (item.imageUrl.startsWith('http://') || item.imageUrl.startsWith('https://')) {
      return item.imageUrl;
    }
    return `${apiUrl}${item.imageUrl}`;
  }
  
  // Check cache for stock photo
  const cacheKey = item.subCategory ? `${item.category}:${item.subCategory}` : item.category;
  if (stockPhotoCache[cacheKey]) {
    return stockPhotoCache[cacheKey];
  }
  
  // Pre-fetch stock photo in the background (fire and forget)
  fetchStockPhotoUrl(item.category, item.subCategory, apiUrl).catch(() => {
    // Silently fail - we'll just use the placeholder
  });
  
  // Fallback to static placeholder
  return getPlaceholderImage(item.category);
};

/**
 * Pre-fetch stock photos for multiple items in the background
 * Useful for preloading stock photos when a component mounts
 */
export const preFetchStockPhotos = (items: Array<{ category: string; subCategory?: string }>, apiUrl: string): void => {
  items.forEach(item => {
    if (!item.category) return;
    const cacheKey = item.subCategory ? `${item.category}:${item.subCategory}` : item.category;
    if (!stockPhotoCache[cacheKey]) {
      fetchStockPhotoUrl(item.category, item.subCategory, apiUrl).catch(() => {
        // Silently fail
      });
    }
  });
};

