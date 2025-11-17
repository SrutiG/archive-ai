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
  const hasTriedStockPhoto = useRef(false);
  const hasTriedPlaceholder = useRef(false);

  useEffect(() => {
    let isMounted = true;
    // Reset flags when item changes
    hasTriedStockPhoto.current = false;
    hasTriedPlaceholder.current = false;

    const loadImage = async () => {
      // Show placeholder immediately while loading
      const placeholder = getPlaceholderImage(item.category);
      if (isMounted) {
        setImageSrc(placeholder);
      }
      
      // Try to load the image (getItemImageUrl will skip broken local paths and use stock photos)
      try {
        const imageUrl = await getItemImageUrl(item, apiUrl);
        if (isMounted) {
          setImageSrc(imageUrl);
          
          // If we got a stock photo (not placeholder), cache it
          if (imageUrl !== placeholder && imageUrl.includes('supabase.co')) {
            (window as any).__stockPhotoCache = (window as any).__stockPhotoCache || {};
            const cacheKey = item.subCategory || item.sub_category 
              ? `${item.category}:${item.subCategory || item.sub_category}` 
              : item.category;
            (window as any).__stockPhotoCache[cacheKey] = imageUrl;
          }
          
          if (imageUrl === placeholder) {
            hasTriedPlaceholder.current = true;
          }
        }
      } catch (error) {
        // Network error - keep placeholder
        if (isMounted) {
          console.warn('Failed to load image (network error), using placeholder:', error);
          setImageSrc(placeholder);
          hasTriedPlaceholder.current = true;
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [item, apiUrl]);

  // Use imageSrc if set, otherwise show placeholder while loading
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

