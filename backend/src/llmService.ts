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
    if (ext === '.webp') mimeType = 'image/webp';
    
    console.log('[LLM] Calling OpenAI API for categorization...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion categorization assistant. Based on the image and title, categorize the item into one of these categories: ${CATEGORIES.join(', ')}. Return only the category name, nothing else.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Categorize this item: "${title}". Return only the category name from this list: ${CATEGORIES.join(', ')}`
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
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    console.log(`[LLM] API call took ${duration}ms`);

    const category = response.choices[0]?.message?.content?.trim();
    if (!category) {
      console.error('[LLM] No category returned from API');
      throw new Error('No category returned from LLM');
    }

    // Validate category
    const normalizedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    if (CATEGORIES.includes(normalizedCategory)) {
      console.log(`[LLM] Categorized "${title}" as: ${normalizedCategory}`);
      return normalizedCategory;
    }

    // Fallback: try to find closest match
    const closestCategory = CATEGORIES.find(cat => 
      cat.toLowerCase().includes(category.toLowerCase()) || 
      category.toLowerCase().includes(cat.toLowerCase())
    );
    
    if (closestCategory) {
      console.log(`[LLM] Categorized "${title}" as: ${closestCategory} (normalized from "${category}")`);
      return closestCategory;
    }

    console.log(`[LLM] Could not match category "${category}", using fallback`);
    console.log('[LLM] Using fallback category: Accessories');
    return 'Accessories';
  } catch (error) {
    console.error('[LLM] Error categorizing item:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    console.log('[LLM] Using fallback category: Accessories');
    return 'Accessories';
  }
}

export interface OutfitFeedback {
  id: string;
  itemTitles: string[];
  type: 'like' | 'dislike';
  feedback?: string;
  createdAt: string;
  prompt?: string;
}

export async function generateOutfits(
  itemsByCategory: Record<string, WardrobeItem[]>,
  userProfile?: { height?: number; weight?: number; heightUnit?: string; weightUnit?: string; stylePreferences?: string; brands?: string[] },
  prompt?: string,
  feedback?: OutfitFeedback[]
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

    // Add prompt context if provided
    let promptContext = '';
    if (prompt) {
      promptContext = `Additional context: ${prompt}. `;
      console.log(`[LLM] Generation prompt: ${prompt}`);
    }

    // Add feedback context if provided
    let feedbackContext = '';
    if (feedback && feedback.length > 0) {
      const likes = feedback.filter(f => f.type === 'like');
      const dislikes = feedback.filter(f => f.type === 'dislike');
      
      const feedbackParts: string[] = [];
      
      if (likes.length > 0) {
        const likedItems = likes.map(f => {
          let desc = f.itemTitles.join(', ');
          if (f.feedback) {
            desc += ` (user note: ${f.feedback})`;
          }
          return desc;
        }).join('; ');
        feedbackParts.push(`User liked these outfits: ${likedItems}`);
      }
      
      if (dislikes.length > 0) {
        const dislikedItems = dislikes.map(f => {
          let desc = f.itemTitles.join(', ');
          if (f.feedback) {
            desc += ` (user note: ${f.feedback})`;
          }
          return desc;
        }).join('; ');
        feedbackParts.push(`User disliked these outfits: ${dislikedItems}`);
      }
      
      if (feedbackParts.length > 0) {
        feedbackContext = `User feedback on previous outfits: ${feedbackParts.join('. ')}. Use this feedback to generate better outfits that align with user preferences. `;
        console.log(`[LLM] Including ${feedback.length} feedback entries (${likes.length} likes, ${dislikes.length} dislikes)`);
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
          content: `${userContext}${promptContext}${feedbackContext}Generate outfit combinations from these items:\n${itemsDescription}\n\nConsider the user's body measurements, style preferences, and the detailed descriptions of each item when creating stylish and well-fitting outfit combinations that match their personal aesthetic. ${prompt ? 'Pay special attention to the additional context provided above.' : ''} ${feedback && feedback.length > 0 ? 'Use the user feedback to avoid creating similar outfits to ones they disliked and to create more outfits similar to ones they liked.' : ''} Return a JSON object with an "outfits" key containing an array of arrays with item titles. Generate exactly 5 outfit combinations.`
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

export interface ExploreSuggestion {
  title: string;
  category: string;
  description: string;
  brand?: string; // Brand or store name
  pairsWellWith: string[];
}

export async function generateExploreSuggestions(
  wardrobeItems: WardrobeItem[],
  userProfile?: { height?: number; weight?: number; heightUnit?: string; weightUnit?: string; stylePreferences?: string; brands?: string[] },
  feedback?: OutfitFeedback[]
): Promise<ExploreSuggestion[]> {
  try {
    console.log('[LLM] Starting explore suggestions generation...');
    
    // Group items by category
    const itemsByCategory = wardrobeItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WardrobeItem[]>);

    // Build wardrobe summary
    const categorySummary = Object.entries(itemsByCategory)
      .map(([category, items]) => `${category}: ${items.length} items (${items.map(i => i.title).join(', ')})`)
      .join('\n');

    const allItemTitles = wardrobeItems.map(item => item.title).join(', ');
    
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
      
      if (userProfile.brands && userProfile.brands.length > 0) {
        contextParts.push(`Favorite brands: ${userProfile.brands.join(', ')}`);
      }
      
      if (contextParts.length > 0) {
        userContext = `User profile: ${contextParts.join('. ')}. `;
      }
    }

    // Add feedback context if provided
    let feedbackContext = '';
    if (feedback && feedback.length > 0) {
      const likes = feedback.filter(f => f.type === 'like');
      const dislikes = feedback.filter(f => f.type === 'dislike');
      
      const feedbackParts: string[] = [];
      
      if (likes.length > 0) {
        const likedItems = likes.map(f => f.itemTitles.join(', ')).join('; ');
        feedbackParts.push(`User liked outfits with: ${likedItems}`);
      }
      
      if (dislikes.length > 0) {
        const dislikedItems = dislikes.map(f => f.itemTitles.join(', ')).join('; ');
        feedbackParts.push(`User disliked outfits with: ${dislikedItems}`);
      }
      
      if (feedbackParts.length > 0) {
        feedbackContext = `User feedback: ${feedbackParts.join('. ')}. `;
      }
    }

    console.log('[LLM] Calling OpenAI API for explore suggestions...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion stylist and wardrobe consultant. Analyze the user's wardrobe and identify gaps or missing pieces that would enhance their style. Suggest specific items that would complement their existing wardrobe and match their style preferences. When suggesting brands, consider the user's favorite brands and suggest items similar in style/aesthetic to those brands, but don't limit yourself to only those brands. Return suggestions as a JSON object with a key "suggestions" containing an array of objects, each with: "title" (specific item name, e.g., "Black Leather Ankle Boots", "Oversized White Button-Down Shirt"), "category" (from: ${CATEGORIES.join(', ')}), "description" (detailed description of the item including color, style, fit, etc.), "brand" (brand or store name where this item could be found - can be the exact brand if appropriate, or "similar to X brand" to indicate items with similar aesthetic to user's favorite brands, e.g., "Rick Owens", "similar to Rick Owens", "Zara", "Everlane", "Vintage"), and "pairsWellWith" (array of 2-4 existing wardrobe item titles it would pair well with). Do NOT include "link" or "imageUrl" fields - these will be generated automatically. Generate up to 9 suggestions.`
        },
        {
          role: 'user',
          content: `${userContext}${feedbackContext}Analyze this wardrobe and suggest items that would fill gaps or enhance the collection:\n\nCurrent wardrobe:\n${categorySummary}\n\nAll items: ${allItemTitles}\n\nBased on the user's style preferences, favorite brands, and existing wardrobe, suggest up to 9 specific items that would complement their collection. When suggesting brands, consider the user's favorite brands and suggest items with similar aesthetic/style to those brands (you can say "similar to [brand name]" if suggesting a different brand with similar aesthetic, or use the exact brand name if appropriate). For each suggestion, provide: a specific item name (e.g., "Black Leather Ankle Boots" not just "boots"), a detailed description including color, style, and fit, a brand/store name where this item could be found (be specific with designer names or stores that match the user's style, or use "similar to [brand]" format), and list 2-4 existing wardrobe items it would pair well with. Do NOT include links or image URLs - these will be generated automatically. Return a JSON object with a "suggestions" key containing an array of suggestion objects.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.8,
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
    
    // Parse the response
    let suggestions: ExploreSuggestion[];
    try {
      const parsed = JSON.parse(content);
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions;
        // Validate and limit to 9
        suggestions = suggestions
          .filter(s => s.title && s.category && s.description && Array.isArray(s.pairsWellWith))
          .slice(0, 9);
        
        // Validate pairsWellWith items exist in wardrobe
        suggestions = suggestions.map(s => ({
          ...s,
          pairsWellWith: s.pairsWellWith.filter(title => allItemTitles.includes(title)).slice(0, 4)
        })).filter(s => s.pairsWellWith.length > 0);
        
        console.log(`[LLM] Successfully parsed ${suggestions.length} suggestions`);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (parseError) {
      console.error('[LLM] Error parsing LLM response:', parseError);
      if (parseError instanceof Error) {
        console.error('[LLM] Parse error details:', parseError.message);
      }
      throw new Error('Failed to parse suggestions');
    }

    return suggestions;
  } catch (error) {
    console.error('[LLM] Error generating explore suggestions:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    throw error;
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
