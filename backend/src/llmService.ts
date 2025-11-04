import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { WardrobeItem } from './index';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const CATEGORIES = [
  'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 
  'Accessories', 'Bags', 'Jewelry', 'Activewear', 'Underwear'
];

export async function categorizeItem(title: string, imagePath: string): Promise<string> {
  try {
    console.log(`[LLM] Starting categorization for: "${title}"`);
    console.log(`[LLM] Image path: ${imagePath}`);
    
    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageSizeKB = (imageBuffer.length / 1024).toFixed(2);
    console.log(`[LLM] Image size: ${imageSizeKB} KB`);
    
    // Determine the image MIME type
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    console.log(`[LLM] Image MIME type: ${mimeType}`);

    console.log(`[LLM] Calling OpenAI API for categorization...`);
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using the cheaper mini model
      messages: [
        {
          role: 'system',
          content: `You are a fashion expert. Categorize wardrobe items into one of these categories: ${CATEGORIES.join(', ')}. 
          Return only the category name, nothing else.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Categorize this wardrobe item titled "${title}" into one of these categories: ${CATEGORIES.join(', ')}. Return only the category name.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 10,
      temperature: 0.3
    });
    const duration = Date.now() - startTime;
    
    const category = response.choices[0]?.message?.content?.trim() || 'Accessories';
    console.log(`[LLM] Raw category from API: "${category}"`);
    console.log(`[LLM] API call took ${duration}ms`);
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    
    // Validate that the category is in our list
    const normalizedCategory = CATEGORIES.find(
      cat => cat.toLowerCase() === category.toLowerCase()
    ) || 'Accessories';
    
    if (normalizedCategory !== category) {
      console.log(`[LLM] Normalized category from "${category}" to "${normalizedCategory}"`);
    }
    
    console.log(`[LLM] Final category: "${normalizedCategory}"`);
    return normalizedCategory;
  } catch (error) {
    console.error('[LLM] Error categorizing item:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
    }
    // Fallback to a default category
    console.log('[LLM] Using fallback category: Accessories');
    return 'Accessories';
  }
}

export async function generateOutfits(
  itemsByCategory: Record<string, WardrobeItem[]>,
  userProfile?: { height?: number; weight?: number; heightUnit?: string; weightUnit?: string; stylePreferences?: string }
): Promise<string[][]> {
  try {
    console.log('[LLM] Starting outfit generation...');
    
    // Build a detailed description of available items with descriptions
    const itemsDescription = Object.entries(itemsByCategory)
      .map(([category, items]) => {
        const itemsList = items.map(item => {
          let itemDesc = item.title;
          if (item.description) {
            itemDesc += ` (${item.description})`;
          }
          if (item.measurements) {
            const measurementsStr = Object.entries(item.measurements)
              .filter(([_, v]) => v !== undefined && v !== null)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            if (measurementsStr) {
              itemDesc += ` [${measurementsStr}]`;
            }
          }
          return itemDesc;
        }).join(', ');
        return `${category}: ${itemsList}`;
      })
      .join('\n');
    
    const totalItems = Object.values(itemsByCategory).flat().length;
    console.log(`[LLM] Generating outfits from ${totalItems} items across ${Object.keys(itemsByCategory).length} categories`);
    console.log(`[LLM] Items description length: ${itemsDescription.length} characters`);
    
    // Build user profile context
    let userContext = '';
    if (userProfile) {
      const contextParts: string[] = [];
      
      if (userProfile.height && userProfile.weight) {
        contextParts.push(`Height ${userProfile.height} ${userProfile.heightUnit || 'inches'}, Weight ${userProfile.weight} ${userProfile.weightUnit || 'lbs'}`);
      }
      
      if (userProfile.stylePreferences) {
        contextParts.push(`Style preferences: ${userProfile.stylePreferences}`);
      }
      
      if (contextParts.length > 0) {
        userContext = `User profile: ${contextParts.join('. ')}. `;
      }
    }

    console.log('[LLM] Calling OpenAI API for outfit generation...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion stylist. Generate 5-7 outfit combinations using the available wardrobe items. 
          Each outfit should include items from different categories that work well together.
          Pay close attention to the user's style preferences and personal aesthetic when creating combinations.
          Return the outfits as a JSON object with a key "outfits" containing an array of arrays, where each inner array contains the titles of items in that outfit.
          Example format: {"outfits": [["Blue Shirt", "Black Jeans", "White Sneakers"], ["Red Dress", "Black Heels"]]}
          Only return the JSON object, no other text.`
        },
        {
          role: 'user',
          content: `${userContext}Generate outfit combinations from these items:\n${itemsDescription}\n\nConsider the user's body measurements, style preferences, and the detailed descriptions of each item when creating stylish and well-fitting outfit combinations that match their personal aesthetic. Return a JSON object with an "outfits" key containing an array of arrays with item titles.`
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    const duration = Date.now() - startTime;
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    console.log(`[LLM] API call took ${duration}ms`);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error('[LLM] No response content from API');
      throw new Error('No response from LLM');
    }

    console.log(`[LLM] Response length: ${content.length} characters`);
    
    // Try to parse the response
    let outfits: string[][];
    try {
      const parsed = JSON.parse(content);
      // Handle both { "outfits": [...] } and direct array formats
      if (Array.isArray(parsed)) {
        outfits = parsed;
        console.log('[LLM] Parsed as direct array');
      } else if (parsed.outfits && Array.isArray(parsed.outfits)) {
        outfits = parsed.outfits;
        console.log('[LLM] Parsed as object with outfits key');
      } else {
        // Try to extract arrays from the response
        const arrayMatch = content.match(/\[\[.*?\]\]/s);
        if (arrayMatch) {
          outfits = JSON.parse(arrayMatch[0]);
          console.log('[LLM] Extracted array from response');
        } else {
          throw new Error('Unexpected response format');
        }
      }
      console.log(`[LLM] Successfully parsed ${outfits.length} outfits`);
    } catch (parseError) {
      // Fallback: try to extract outfit combinations from text
      console.error('[LLM] Error parsing LLM response:', parseError);
      if (parseError instanceof Error) {
        console.error('[LLM] Parse error details:', parseError.message);
      }
      console.log('[LLM] Using fallback outfit generation');
      outfits = generateFallbackOutfits(itemsByCategory);
    }

    // Validate and filter outfits
    const allItemTitles = Object.values(itemsByCategory).flat().map(item => item.title);
    const beforeFilter = outfits.length;
    outfits = outfits
      .filter(outfit => Array.isArray(outfit) && outfit.length > 0)
      .map(outfit => outfit.filter(title => allItemTitles.includes(title)))
      .filter(outfit => outfit.length > 0)
      .slice(0, 7); // Limit to 7 outfits
    
    if (beforeFilter !== outfits.length) {
      console.log(`[LLM] Filtered outfits: ${beforeFilter} -> ${outfits.length}`);
    }

    if (outfits.length === 0) {
      console.log('[LLM] No valid outfits generated, using fallback');
      return generateFallbackOutfits(itemsByCategory);
    }
    
    console.log(`[LLM] Successfully generated ${outfits.length} outfit combinations`);
    outfits.forEach((outfit, index) => {
      console.log(`[LLM]   Outfit ${index + 1}: ${outfit.join(' + ')}`);
    });
    
    return outfits;
  } catch (error) {
    console.error('[LLM] Error generating outfits:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    console.log('[LLM] Using fallback outfit generation');
    return generateFallbackOutfits(itemsByCategory);
  }
}

function generateFallbackOutfits(
  itemsByCategory: Record<string, WardrobeItem[]>
): string[][] {
  console.log('[LLM] Generating fallback outfits...');
  const outfits: string[][] = [];
  const categories = Object.keys(itemsByCategory);
  
  if (categories.length < 2) {
    console.log('[LLM] Not enough categories for fallback outfits');
    return outfits;
  }

  // Generate simple combinations
  for (let i = 0; i < Math.min(5, categories.length); i++) {
    const category1 = categories[i % categories.length];
    const category2 = categories[(i + 1) % categories.length];
    
    const items1 = itemsByCategory[category1];
    const items2 = itemsByCategory[category2];
    
    if (items1.length > 0 && items2.length > 0) {
      outfits.push([
        items1[0].title,
        items2[0].title
      ]);
    }
  }

  console.log(`[LLM] Generated ${outfits.length} fallback outfits`);
  return outfits;
}
