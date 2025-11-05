import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { generateOutfits, generateExploreSuggestions } from './llmService';
import * as db from './database';
import * as supabaseStorage from './supabaseStorage';

// Initialize PostgreSQL schema if using PostgreSQL
if (process.env.DATABASE_URL && typeof db.initializeSchema === 'function') {
  db.initializeSchema().catch(err => {
    console.error('Failed to initialize PostgreSQL schema:', err);
  });
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log(`  Body:`, req.body);
  }
  res.on('finish', () => {
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${res.statusCode}`);
  });
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
} else {
  console.log('Uploads directory exists');
}

// Configure multer for file uploads
// Use memory storage when Supabase is configured, disk storage otherwise (fallback)
const storage = supabaseStorage.isSupabaseConfigured()
  ? multer.memoryStorage() // Store in memory, then upload to Supabase
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
      }
    });

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Wardrobe item interface
export interface WardrobeItem {
  id: string;
  title: string;
  imageUrl?: string; // Optional - can use placeholder images if not provided
  category: string;
  description?: string; // Extended description for outfit generation
  measurements?: {
    // Category-specific measurements
    size?: string; // Generic size (S, M, L, XL, etc.)
    waist?: number; // Inches or cm
    inseam?: number; // Inches or cm
    chest?: number; // Inches or cm
    length?: number; // Inches or cm
    shoeSize?: string; // US, EU, UK sizes
    [key: string]: string | number | undefined; // Allow flexible measurements
  };
  createdAt: string;
}

// User profile interface
export interface UserProfile {
  height?: number; // in inches or cm
  weight?: number; // in lbs or kg
  heightUnit?: 'inches' | 'cm';
  weightUnit?: 'lbs' | 'kg';
  stylePreferences?: string; // Personal style preferences description
  brands?: string[]; // Array of favorite brands
  // Additional measurements
  waist?: number;
  chest?: number;
  hips?: number;
  inseam?: number;
  shoeSize?: string;
  measurementsUnit?: 'inches' | 'cm';
  // Appearance details (optional, helps with outfit generation)
  hairColor?: string;
  hairTexture?: string;
  skinColor?: string;
}

// Saved outfit interface
export interface SavedOutfit {
  id: string;
  itemTitles: string[];
  createdAt: string;
  prompt?: string; // Context/prompt used to generate this outfit
  notes?: string; // User's notes about the outfit
}

// Outfit feedback interface
export interface OutfitFeedback {
  id: string;
  itemTitles: string[];
  type: 'like' | 'dislike';
  feedback?: string; // Optional user feedback text
  createdAt: string;
  prompt?: string; // The prompt used when this outfit was generated
}

// Explore suggestion interface
export interface ExploreSuggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  brand?: string; // Brand or store name
  link?: string; // URL to find/buy the item
  pairsWellWith: string[]; // Array of existing wardrobe item titles
  imageUrl?: string; // URL to product image (from LLM or generated)
  createdAt: string;
}

// Multi-user data storage
const MAX_OUTFIT_CLICKS_PER_DAY = 10;

// Helper function to get user data (works with both SQLite and PostgreSQL)
async function getUserData(userId: string) {
  const userDataRecord = await db.getUserData(userId);
  const items = await db.getItemsByUser(userId);
  const profile = await db.getProfile(userId);
  const savedOutfits = await db.getSavedOutfits(userId);
  const outfitFeedback = await db.getFeedback(userId);
  const exploreSuggestions = await db.getExploreSuggestions(userId);
  const lastExploreUpdate = await db.getExploreUpdate(userId);
  
  return {
    items,
    outfitGenerationClicks: userDataRecord?.outfit_generation_clicks || 0,
    lastClickResetDate: userDataRecord?.last_click_reset_date || new Date().toDateString(),
    userProfile: profile || {},
    savedOutfits,
    outfitFeedback,
    exploreSuggestions,
    lastExploreUpdate: lastExploreUpdate || ''
  };
}

// Middleware to extract user ID from request
function getUserFromRequest(req: any): string {
  // Express normalizes headers to lowercase, but check both cases for compatibility
  const userId = req.headers['x-user-id'] || req.headers['x-user-id'] || req.query.userId || 'default-user';
  if (!userId || userId === 'default-user') {
    console.warn(`⚠️  No valid user ID in request. Headers:`, req.headers);
  }
  return userId as string;
}

console.log('Multi-user wardrobe app initialized');

// Reset click counter if it's a new day
async function resetClickCounterIfNeeded(userId: string) {
  const userData = await getUserData(userId);
  const today = new Date().toDateString();
  if (today !== userData.lastClickResetDate) {
    console.log(`Day changed for user ${userId}: Resetting outfit generation clicks from ${userData.outfitGenerationClicks} to 0`);
    await db.updateUserData(userId, 0, today);
  }
}

// Routes
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok' });
});

// User management endpoints
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    console.log(`Returning ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'User name is required' });
    }
    
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    const newUser = await db.createUser(id, name, createdAt);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Reload data from storage (useful after seeding)
app.post('/api/reload', async (req, res) => {
  try {
    console.log('Reloading data from database...');
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    console.log(`Reloaded data for user ${userId}: ${userData.items.length} items`);
    res.json({ 
      message: 'Data reloaded successfully',
      itemsCount: userData.items.length,
      clicksUsed: userData.outfitGenerationClicks
    });
  } catch (error) {
    console.error('Error reloading data:', error);
    res.status(500).json({ error: 'Failed to reload data' });
  }
});

// Get all wardrobe items
app.get('/api/items', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    console.log(`📥 GET /api/items - User ID: "${userId}", Headers:`, {
      'x-user-id': req.headers['x-user-id'],
      'X-User-Id': req.headers['x-user-id']
    });
    
    const userData = await getUserData(userId);
    console.log(`✅ Returning ${userData.items.length} wardrobe items for user ${userId}`);
    
    if (userData.items.length > 0) {
      userData.items.slice(0, 3).forEach((item: WardrobeItem, index: number) => {
        console.log(`  Item ${index + 1}: "${item.title}" (ID: ${item.id}, Category: ${item.category})`);
      });
      if (userData.items.length > 3) {
        console.log(`  ... and ${userData.items.length - 3} more items`);
      }
    } else {
      console.log(`  ⚠️  No items found for user ${userId}`);
      console.log(`  💡 This might mean the user doesn't exist in the database. Check if user ID is correct.`);
    }
    
    res.json(userData.items);
  } catch (error) {
    console.error('❌ Error fetching items:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Get items grouped by category
app.get('/api/items/by-category', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const grouped = userData.items.reduce((acc: Record<string, WardrobeItem[]>, item: WardrobeItem) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WardrobeItem[]>);
    
    const categoryCount = Object.keys(grouped).length;
    console.log(`Returning items grouped by ${categoryCount} categories for user ${userId}`);
    res.json(grouped);
  } catch (error) {
    console.error('Error fetching items by category:', error);
    res.status(500).json({ error: 'Failed to fetch items by category' });
  }
});

// Upload photo and create item
app.post('/api/items', upload.single('photo'), async (req, res) => {
  try {
    console.log('Creating new wardrobe item...');
    
    const { title, category, description, measurements } = req.body;
    
    if (!title) {
      console.error('Title is missing');
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!category) {
      console.error('Category is missing');
      return res.status(400).json({ error: 'Category is required' });
    }

    console.log(`Processing item: "${title}"`);
    console.log(`  Category: ${category}`);
    if (req.file) {
      console.log(`  File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
    } else {
      console.log(`  No photo provided - item will use category placeholder`);
    }

    // Upload to Supabase if configured, otherwise use local storage
    let imageUrl: string | undefined = undefined;
    if (req.file) {
      if (supabaseStorage.isSupabaseConfigured()) {
        try {
          // Upload to Supabase Storage
          const fileName = `${uuidv4()}-${req.file.originalname}`;
          imageUrl = await supabaseStorage.uploadBuffer(
            req.file.buffer,
            fileName,
            req.file.mimetype
          );
          console.log(`  Uploaded to Supabase: ${imageUrl}`);
        } catch (error) {
          console.error('Failed to upload to Supabase:', error);
          // Fall back to local storage if Supabase upload fails
          const localPath = path.join(uploadsDir, `${uuidv4()}-${req.file.originalname}`);
          fs.writeFileSync(localPath, req.file.buffer);
          imageUrl = `/uploads/${path.basename(localPath)}`;
          console.log(`  Fallback to local storage: ${imageUrl}`);
        }
      } else {
        // Local storage (fallback when Supabase not configured)
        imageUrl = `/uploads/${req.file.filename}`;
      }
    }
    
    // Parse measurements if provided
    let parsedMeasurements: WardrobeItem['measurements'] = undefined;
    if (measurements) {
      try {
        parsedMeasurements = typeof measurements === 'string' 
          ? JSON.parse(measurements) 
          : measurements;
        console.log('  Measurements:', parsedMeasurements);
      } catch (e) {
        console.warn('Failed to parse measurements, continuing without them');
      }
    }

    const newItem: WardrobeItem = {
      id: uuidv4(),
      title,
      ...(imageUrl && { imageUrl }), // Only include imageUrl if it exists
      category,
      description: description || undefined,
      measurements: parsedMeasurements,
      createdAt: new Date().toISOString()
    };

    const userId = getUserFromRequest(req);
    
    // Save to database
    await db.insertItem(newItem, userId);
    
    console.log(`Item created successfully for user ${userId}`);
    console.log(`New item ID: ${newItem.id}, Title: "${newItem.title}"`);

    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Generate outfit combinations
app.post('/api/outfits/generate', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    
    console.log(`Generating outfit combinations for user ${userId}...`);
    await resetClickCounterIfNeeded(userId);

    if (userData.outfitGenerationClicks >= MAX_OUTFIT_CLICKS_PER_DAY) {
      console.log(`Daily limit reached for user ${userId}: ${userData.outfitGenerationClicks}/${MAX_OUTFIT_CLICKS_PER_DAY} clicks used`);
      return res.status(429).json({ 
        error: 'Daily limit reached. Please try again tomorrow.',
        clicksUsed: userData.outfitGenerationClicks,
        maxClicks: MAX_OUTFIT_CLICKS_PER_DAY
      });
    }

    // Group items by category
    const itemsByCategory = userData.items.reduce((acc: Record<string, WardrobeItem[]>, item: WardrobeItem) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WardrobeItem[]>);

    // Check if we have enough items in different categories
    const categoryCount = Object.keys(itemsByCategory).length;
    console.log(`Items grouped into ${categoryCount} categories for user ${userId}`);
    
    Object.entries(itemsByCategory).forEach(([category, items]) => {
      const categoryItems = items as WardrobeItem[];
      console.log(`  ${category}: ${categoryItems.length} items`);
    });

    if (categoryCount < 2) {
      console.log(`Not enough categories for user ${userId}: ${categoryCount} (need at least 2)`);
      return res.status(400).json({ 
        error: 'Need at least 2 different categories to generate outfits',
        categories: categoryCount
      });
    }

    // Get optional prompt and selected item IDs from request body
    const { prompt, selectedItemIds } = req.body;
    if (prompt) {
      console.log(`Generation prompt: ${prompt}`);
    }
    
    // Get selected items if provided
    let selectedItems: WardrobeItem[] = [];
    if (selectedItemIds && Array.isArray(selectedItemIds) && selectedItemIds.length > 0) {
      selectedItems = userData.items.filter((item: WardrobeItem) => selectedItemIds.includes(item.id));
      console.log(`Selected items for outfit generation: ${selectedItems.length} items`);
      selectedItems.forEach(item => {
        console.log(`  - ${item.title} (${item.category})`);
      });
    }

    // Generate outfits using LLM with user profile and item descriptions
    console.log('Calling LLM to generate outfit combinations...');
    const userProfile = userData.userProfile || {};
    console.log(`User profile: Height ${userProfile.height || 'N/A'} ${userProfile.heightUnit || ''}, Weight ${userProfile.weight || 'N/A'} ${userProfile.weightUnit || ''}`);
    if (userProfile.stylePreferences) {
      console.log(`Style preferences: ${userProfile.stylePreferences.substring(0, 100)}...`);
    }
    const outfits = await generateOutfits(itemsByCategory, userProfile, prompt, userData.outfitFeedback || [], selectedItems);
    console.log(`Generated ${outfits.length} outfit combinations`);
    
    const newClicks = userData.outfitGenerationClicks + 1;
    console.log(`Outfit generation clicks for user ${userId}: ${newClicks}/${MAX_OUTFIT_CLICKS_PER_DAY}`);
    
    // Save to database
    await db.updateUserData(userId, newClicks, userData.lastClickResetDate);

    res.json({
      outfits,
      clicksUsed: userData.outfitGenerationClicks,
      maxClicks: MAX_OUTFIT_CLICKS_PER_DAY
    });
  } catch (error) {
    console.error('Error generating outfits:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to generate outfits' });
  }
});

// Get outfit generation status
app.get('/api/outfits/status', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    await resetClickCounterIfNeeded(userId);
    const userData = await getUserData(userId);
    const status = {
      clicksUsed: userData.outfitGenerationClicks,
      maxClicks: MAX_OUTFIT_CLICKS_PER_DAY,
      remaining: MAX_OUTFIT_CLICKS_PER_DAY - userData.outfitGenerationClicks
    };
    console.log(`Outfit generation status for user ${userId}: ${status.clicksUsed}/${status.maxClicks} clicks used, ${status.remaining} remaining`);
    res.json(status);
  } catch (error) {
    console.error('Error fetching outfit status:', error);
    res.status(500).json({ error: 'Failed to fetch outfit status' });
  }
});

// Update an item
app.put('/api/items/:id', upload.single('photo'), async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const { id } = req.params;
    console.log(`Updating item with ID: ${id} for user ${userId}`);
    
    const existingItem = await db.getItemById(id);
    
    if (!existingItem || existingItem.userId !== userId) {
      console.log(`Item not found: ${id} for user ${userId}`);
      return res.status(404).json({ error: 'Item not found' });
    }
    const { title, category, description, measurements } = req.body;
    
    if (!title) {
      console.error('Title is missing');
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!category) {
      console.error('Category is missing');
      return res.status(400).json({ error: 'Category is required' });
    }

    console.log(`Updating item: "${existingItem.title}" -> "${title}"`);

    // Handle new photo upload if provided
    let imageUrl = existingItem.imageUrl;
    if (req.file) {
      // Delete old image file if it exists
      if (existingItem.imageUrl) {
        if (supabaseStorage.isSupabaseConfigured()) {
          // Delete from Supabase
          try {
            await supabaseStorage.deleteFile(existingItem.imageUrl);
          } catch (error) {
            console.warn('Failed to delete old file from Supabase:', error);
          }
        } else {
          // Delete from local storage
          const oldFilePath = path.join(__dirname, '../uploads', path.basename(existingItem.imageUrl));
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            console.log(`Deleted old file: ${oldFilePath}`);
          }
        }
      }
      
      // Upload new image
      if (supabaseStorage.isSupabaseConfigured()) {
        try {
          // Upload to Supabase Storage
          const fileName = `${uuidv4()}-${req.file.originalname}`;
          imageUrl = await supabaseStorage.uploadBuffer(
            req.file.buffer,
            fileName,
            req.file.mimetype
          );
          console.log(`  Uploaded to Supabase: ${imageUrl}`);
        } catch (error) {
          console.error('Failed to upload to Supabase:', error);
          // Fall back to local storage if Supabase upload fails
          const localPath = path.join(uploadsDir, `${uuidv4()}-${req.file.originalname}`);
          fs.writeFileSync(localPath, req.file.buffer);
          imageUrl = `/uploads/${path.basename(localPath)}`;
          console.log(`  Fallback to local storage: ${imageUrl}`);
        }
      } else {
        // Local storage (fallback when Supabase not configured)
        imageUrl = `/uploads/${req.file.filename}`;
      }
      console.log(`  New file: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
    }

    // Parse measurements if provided
    let parsedMeasurements: WardrobeItem['measurements'] = existingItem.measurements;
    if (measurements) {
      try {
        parsedMeasurements = typeof measurements === 'string' 
          ? JSON.parse(measurements) 
          : measurements;
        console.log('  Measurements:', parsedMeasurements);
      } catch (e) {
        console.warn('Failed to parse measurements, keeping existing');
      }
    }

    // Update the item in database
    await db.updateItem(id, {
      title,
      category,
      description: description || undefined,
      measurements: parsedMeasurements,
      imageUrl
    });

    const updatedItem = await db.getItemById(id);
    console.log(`Item updated successfully for user ${userId}: "${updatedItem?.title}"`);

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete an item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const { id } = req.params;
    console.log(`Deleting item with ID: ${id} for user ${userId}`);
    
    // Get item from database to check ownership and get imageUrl
    const item = await db.getItemById(id);
    
    if (!item || item.userId !== userId) {
      console.log(`Item not found or not owned by user: ${id} for user ${userId}`);
      return res.status(404).json({ error: 'Item not found' });
    }

    console.log(`Deleting item for user ${userId}: "${item.title}" (${item.category})`);
    
    // Delete the file if it exists
    if (item.imageUrl) {
      if (supabaseStorage.isSupabaseConfigured()) {
        // Delete from Supabase
        try {
          await supabaseStorage.deleteFile(item.imageUrl);
        } catch (error) {
          console.warn('Failed to delete file from Supabase:', error);
        }
      } else {
        // Delete from local storage
        const filePath = path.join(__dirname, '../uploads', path.basename(item.imageUrl));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file: ${filePath}`);
        } else {
          console.log(`File not found: ${filePath}`);
        }
      }
    } else {
      console.log('No image file to delete (item has no imageUrl)');
    }

    // Delete from database
    await db.deleteItem(id);
    console.log(`Item deleted for user ${userId}`);
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Get user profile
app.get('/api/user/profile', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    console.log(`Fetching user profile for user ${userId}`);
    res.json(userData.userProfile || {});
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
app.post('/api/user/profile', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { 
      height, weight, heightUnit, weightUnit, stylePreferences, brands,
      waist, chest, hips, inseam, shoeSize, measurementsUnit,
      hairColor, hairTexture, skinColor
    } = req.body;
    
    const updatedProfile: UserProfile = {
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      heightUnit: heightUnit || 'inches',
      weightUnit: weightUnit || 'lbs',
      stylePreferences: stylePreferences || undefined,
      brands: brands && Array.isArray(brands) ? brands : undefined,
      waist: waist ? Number(waist) : undefined,
      chest: chest ? Number(chest) : undefined,
      hips: hips ? Number(hips) : undefined,
      inseam: inseam ? Number(inseam) : undefined,
      shoeSize: shoeSize || undefined,
      measurementsUnit: measurementsUnit || 'inches',
      hairColor: hairColor || undefined,
      hairTexture: hairTexture || undefined,
      skinColor: skinColor || undefined
    };
    
    // Save to database
    await db.upsertProfile(userId, updatedProfile);
    console.log(`Updated user profile for user ${userId}:`, updatedProfile);
    if (stylePreferences) {
      console.log(`Style preferences: ${stylePreferences.substring(0, 100)}...`);
    }
    if (hairColor || hairTexture || skinColor) {
      console.log(`Appearance: hairColor=${hairColor || 'N/A'}, hairTexture=${hairTexture || 'N/A'}, skinColor=${skinColor || 'N/A'}`);
    }
    
    res.json(updatedProfile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Get available categories
app.get('/api/categories', (req, res) => {
  const categories = [
    'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 
    'Accessories', 'Bags', 'Jewelry', 'Activewear', 'Underwear'
  ];
  res.json(categories);
});

// Get saved outfits
app.get('/api/outfits/saved', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    console.log(`Returning ${(userData.savedOutfits || []).length} saved outfits for user ${userId}`);
    res.json(userData.savedOutfits || []);
  } catch (error) {
    console.error('Error fetching saved outfits:', error);
    res.status(500).json({ error: 'Failed to fetch saved outfits' });
  }
});

// Save an outfit
app.post('/api/outfits/save', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { itemTitles, prompt, notes } = req.body;
    
    if (!itemTitles || !Array.isArray(itemTitles) || itemTitles.length === 0) {
      return res.status(400).json({ error: 'Item titles are required' });
    }

    // Validate that all items exist
    const allItemTitles = userData.items.map((item: WardrobeItem) => item.title);
    const invalidTitles = itemTitles.filter((title: string) => !allItemTitles.includes(title));
    if (invalidTitles.length > 0) {
      return res.status(400).json({ 
        error: 'Some items not found in wardrobe',
        invalidItems: invalidTitles
      });
    }

    const newOutfit: SavedOutfit = {
      id: uuidv4(),
      itemTitles,
      createdAt: new Date().toISOString(),
      prompt: prompt || undefined,
      notes: notes || undefined
    };

    // Save to database
    await db.insertSavedOutfit(userId, newOutfit);
    
    console.log(`Saved outfit with ${itemTitles.length} items for user ${userId}`);
    res.status(201).json(newOutfit);
  } catch (error) {
    console.error('Error saving outfit:', error);
    res.status(500).json({ error: 'Failed to save outfit' });
  }
});

// Delete a saved outfit
app.delete('/api/outfits/saved/:id', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { id } = req.params;
    
    if (!userData.savedOutfits) {
      return res.status(404).json({ error: 'Outfit not found' });
    }
    
    const outfitIndex = userData.savedOutfits.findIndex((outfit: SavedOutfit) => outfit.id === id);
    
    if (outfitIndex === -1) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    // Delete from database
    await db.deleteSavedOutfit(id);
    
    console.log(`Deleted saved outfit: ${id} for user ${userId}`);
    res.json({ message: 'Outfit deleted successfully' });
  } catch (error) {
    console.error('Error deleting outfit:', error);
    res.status(500).json({ error: 'Failed to delete outfit' });
  }
});

// Save outfit feedback
app.post('/api/outfits/feedback', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { itemTitles, type, feedback, prompt } = req.body;
    
    if (!itemTitles || !Array.isArray(itemTitles) || itemTitles.length === 0) {
      return res.status(400).json({ error: 'Item titles are required' });
    }

    if (!type || (type !== 'like' && type !== 'dislike')) {
      return res.status(400).json({ error: 'Feedback type must be "like" or "dislike"' });
    }

    const newFeedback: OutfitFeedback = {
      id: uuidv4(),
      itemTitles,
      type,
      feedback: feedback || undefined,
      createdAt: new Date().toISOString(),
      prompt: prompt || undefined
    };

    // Save to database
    await db.insertFeedback(userId, newFeedback);
    
    console.log(`Saved ${type} feedback for outfit with ${itemTitles.length} items for user ${userId}`);
    res.status(201).json(newFeedback);
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Get all feedback
app.get('/api/outfits/feedback', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    console.log(`Returning ${(userData.outfitFeedback || []).length} feedback entries for user ${userId}`);
    res.json(userData.outfitFeedback || []);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Delete feedback
app.delete('/api/outfits/feedback/:id', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { id } = req.params;
    
    if (!userData.outfitFeedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    const feedbackIndex = userData.outfitFeedback.findIndex((f: OutfitFeedback) => f.id === id);
    
    if (feedbackIndex === -1) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Delete from database
    await db.deleteFeedback(id);
    
    console.log(`Deleted feedback: ${id} for user ${userId}`);
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Get explore suggestions
app.get('/api/explore/suggestions', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const today = new Date().toDateString();
    const lastUpdate = userData.lastExploreUpdate || '';
    const shouldUpdate = !lastUpdate || lastUpdate !== today;
    
    console.log(`Explore suggestions requested for user ${userId}. Last update: ${lastUpdate || 'never'}, Today: ${today}`);
    console.log(`Should update: ${shouldUpdate}`);
    
    res.json({
      suggestions: userData.exploreSuggestions || [],
      lastUpdate: lastUpdate,
      shouldUpdate
    });
  } catch (error) {
    console.error('Error fetching explore suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch explore suggestions' });
  }
});

// Generate explore suggestions
app.post('/api/explore/generate', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const forceRefresh = req.query.force === 'true';
    console.log(`Generating explore suggestions for user ${userId}... (force: ${forceRefresh})`);
    
    // Check if already updated today (unless force refresh)
    const today = new Date().toDateString();
    const lastUpdate = userData.lastExploreUpdate || '';
    const suggestions = userData.exploreSuggestions || [];
    
    if (!forceRefresh && lastUpdate === today && suggestions.length > 0) {
      console.log(`Suggestions already generated today for user ${userId}`);
      return res.json({
        suggestions: suggestions,
        lastUpdate: lastUpdate,
        message: 'Suggestions already generated today'
      });
    }

    // Generate suggestions using LLM
    const generatedSuggestions = await generateExploreSuggestions(
      userData.items,
      userData.userProfile || {},
      userData.outfitFeedback || []
    );

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Created uploads directory');
    }

    // Create ExploreSuggestion objects with IDs, images, and product links
    const exploreSuggestionsWithIds: ExploreSuggestion[] = await Promise.all(
      generatedSuggestions.map(async (suggestion: any) => {
        let imageUrl: string | undefined = suggestion.imageUrl;
        let productLink: string | undefined = suggestion.link;
        
        // Build search query for product search
        const searchQuery = suggestion.brand 
          ? `${suggestion.brand} ${suggestion.title}`
          : `${suggestion.title} ${suggestion.category}`;
        
        // If LLM provided an imageUrl, use it directly
        if (imageUrl && imageUrl.startsWith('http')) {
          console.log(`Using LLM-provided image URL for "${suggestion.title}": ${imageUrl}`);
        } else {
          // Use Pexels API for high-quality fashion images
          const pexelsApiKey = process.env.PEXELS_API_KEY;
          if (pexelsApiKey) {
            try {
              const pexelsResponse = await fetch(
                `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery + ' fashion')}&per_page=1&orientation=square`,
                {
                  headers: {
                    'Authorization': pexelsApiKey
                  }
                }
              );
              
              if (pexelsResponse.ok) {
                const pexelsData: any = await pexelsResponse.json();
                if (pexelsData.photos && pexelsData.photos.length > 0) {
                  imageUrl = pexelsData.photos[0].src.medium || pexelsData.photos[0].src.large;
                  console.log(`✅ Found Pexels image for "${suggestion.title}"`);
                } else {
                  console.log(`⚠️  No Pexels photos found for "${suggestion.title}"`);
                }
              } else {
                const errorText = await pexelsResponse.text();
                console.warn(`⚠️  Pexels API error for "${suggestion.title}": ${pexelsResponse.status} ${errorText}`);
              }
            } catch (pexelsError) {
              console.warn(`⚠️  Pexels API exception for "${suggestion.title}":`, pexelsError instanceof Error ? pexelsError.message : pexelsError);
            }
          } else {
            console.log(`⚠️  PEXELS_API_KEY not set, skipping Pexels API for "${suggestion.title}"`);
          }
          
          // Fallback to Unsplash if Pexels fails or no key
          if (!imageUrl) {
            imageUrl = `https://source.unsplash.com/400x400/?${encodeURIComponent(searchQuery + ' fashion')}`;
            console.log(`↩️  Using Unsplash fallback for "${suggestion.title}"`);
          }
        }
        
        // Generate Google Shopping link if no link provided
        if (!productLink || !productLink.startsWith('http')) {
          productLink = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(searchQuery)}`;
          console.log(`Generated Google Shopping link for "${suggestion.title}"`);
        }

        return {
          id: uuidv4(),
          title: suggestion.title,
          category: suggestion.category,
          description: suggestion.description,
          brand: suggestion.brand,
          link: productLink,
          pairsWellWith: suggestion.pairsWellWith,
          imageUrl: imageUrl,
          createdAt: new Date().toISOString()
        };
      })
    );

    // Save to database - delete old suggestions first, then insert new ones
    await db.deleteExploreSuggestions(userId);
    for (const suggestion of exploreSuggestionsWithIds) {
      await db.insertExploreSuggestion(userId, suggestion);
    }
    await db.upsertExploreUpdate(userId, today);
    
    console.log(`Generated ${exploreSuggestionsWithIds.length} explore suggestions for user ${userId}`);
    res.json({
      suggestions: exploreSuggestionsWithIds,
      lastUpdate: today
    });
  } catch (error) {
    console.error('Error generating explore suggestions:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to generate explore suggestions' });
  }
});

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`📸 Pexels API Key: ${process.env.PEXELS_API_KEY ? '✅ Set' : '⚠️  Not set (will use Unsplash fallback)'}`);
    console.log('='.repeat(50));
  });
}

// Export app for testing
export { app };
