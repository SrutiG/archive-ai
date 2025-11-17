import React, { useState, useEffect, useRef } from 'react';
import { getItemImageUrl, getPlaceholderImage } from '../utils/placeholderImages';

interface StockPhotoImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  item: { imageUrl?: string; category: string; subCategory?: string; sub_category?: string };
  apiUrl: string;
}

/**
 * Image component that automatically loads stock photos from Supabase
 * Falls back to static placeholder only if stock photo fails to load (network error or 404)
 */
const StockPhotoImage: React.FC<StockPhotoImageProps> = ({ item, apiUrl, ...imgProps }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const hasTriedPlaceholder = useRef(false);

  useEffect(() => {
    let isMounted = true;
    // Reset flags when item changes
    hasTriedPlaceholder.current = false;

    const loadImage = async () => {
      const placeholder = getPlaceholderImage(item.category);
      
      // If item already has a valid imageUrl (Supabase or external URL), use it immediately
      if (item.imageUrl && 
          (item.imageUrl.includes('supabase.co') || 
           item.imageUrl.startsWith('http://') || 
           item.imageUrl.startsWith('https://'))) {
        // Set the image URL immediately - browser will handle loading
        if (isMounted) {
          setImageSrc(item.imageUrl);
        }
        // Also pre-load in background to ensure it's cached (prevents flicker on re-renders)
        const img = new Image();
        img.onerror = () => {
          // Valid URL failed to load, fall back to stock photo
          if (isMounted) {
            fetchStockPhotoOrPlaceholder();
          }
        };
        img.src = item.imageUrl;
        return;
      }
      
      // Check cache first - if we have a cached stock photo URL, try to use it immediately
      const cacheKey = item.subCategory || item.sub_category 
        ? `${item.category}:${item.subCategory || item.sub_category}` 
        : item.category;
      const cachedUrl = (window as any).__stockPhotoCache?.[cacheKey];
      
      if (cachedUrl && cachedUrl.includes('supabase.co')) {
        // Use cached URL immediately - browser cache will handle if it's already loaded
        // This prevents flicker on subsequent renders
        if (isMounted) {
          setImageSrc(cachedUrl);
        }
        // Also verify it's still valid in the background
        const testImg = new Image();
        testImg.onerror = () => {
          // Cached URL is broken, fetch fresh
          if (isMounted) {
            fetchStockPhotoOrPlaceholder();
          }
        };
        testImg.src = cachedUrl;
        // Start fetching fresh in background to update cache if needed
        fetchStockPhotoOrPlaceholder();
        return;
      }
      
      // No cache, show placeholder and fetch fresh
      if (isMounted) {
        setImageSrc(placeholder);
      }
      fetchStockPhotoOrPlaceholder();
      
      async function fetchStockPhotoOrPlaceholder() {
        // Try to load the image (getItemImageUrl will skip broken local paths and use stock photos)
        try {
          const imageUrl = await getItemImageUrl(item, apiUrl);
          
          if (!isMounted) return;
          
          // If we got a stock photo (not placeholder), pre-load it to avoid flicker
          if (imageUrl !== placeholder && imageUrl.includes('supabase.co')) {
            // Cache the URL
            (window as any).__stockPhotoCache = (window as any).__stockPhotoCache || {};
            (window as any).__stockPhotoCache[cacheKey] = imageUrl;
            
            // Pre-load the image to ensure it's cached before displaying
            // This prevents flicker when switching from placeholder to stock photo
            const img = new Image();
            img.onload = () => {
              if (isMounted) {
                // Image is now loaded and cached, safe to display
                setImageSrc(imageUrl);
              }
            };
            img.onerror = () => {
              // Stock photo failed to load, use placeholder
              if (isMounted) {
                console.warn(`[Stock Photo] Failed to load image from ${imageUrl}, using placeholder`);
                setImageSrc(placeholder);
                hasTriedPlaceholder.current = true;
              }
            };
            img.src = imageUrl;
          } else {
            // Got placeholder or no stock photo - show immediately
            if (isMounted) {
              setImageSrc(placeholder);
              if (imageUrl === placeholder) {
                hasTriedPlaceholder.current = true;
              }
            }
          }
        } catch (error) {
          // Network error - use placeholder
          if (isMounted) {
            console.warn('Failed to load image (network error), using placeholder:', error);
            setImageSrc(placeholder);
            hasTriedPlaceholder.current = true;
          }
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [item, apiUrl]);

  // Show placeholder while loading, then switch to actual image once loaded
  const displaySrc = imageSrc || getPlaceholderImage(item.category);

  return (
    <img
      {...imgProps}
      src={displaySrc}
      alt={imgProps.alt || item.category}
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        const currentSrc = img.src;
        
        // Prevent infinite loops - if we've already tried placeholder, stop
        if (hasTriedPlaceholder.current || currentSrc.includes('placeholder')) {
          if (imgProps.onError) {
            imgProps.onError(e);
          }
          return;
        }
        
        // If stock photo failed to load, fall back to placeholder
        if (currentSrc.includes('supabase.co') && !currentSrc.includes('placeholder')) {
          console.log(`[Stock Photo] Stock photo failed to load, using placeholder for ${item.category}`);
          hasTriedPlaceholder.current = true;
          const placeholder = getPlaceholderImage(item.category);
          img.src = placeholder;
          setImageSrc(placeholder);
        }
        
        if (imgProps.onError) {
          imgProps.onError(e);
        }
      }}
    />
  );
};

export default StockPhotoImage;

