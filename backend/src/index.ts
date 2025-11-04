import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { generateOutfits } from './llmService';
import { loadWardrobeData, saveItems, saveOutfitClicks, saveUserProfile } from './storage';

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
const storage = multer.diskStorage({
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
  imageUrl: string;
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
}

// Load data from storage on startup
const initialData = loadWardrobeData();
let wardrobeItems: WardrobeItem[] = initialData.items;
let outfitGenerationClicks = initialData.outfitGenerationClicks;
let userProfile: UserProfile = initialData.userProfile || {};
const MAX_OUTFIT_CLICKS_PER_DAY = 10;
let lastClickResetDate = initialData.lastClickResetDate;

console.log(`Loaded ${wardrobeItems.length} items from persistent storage`);
console.log(`Outfit generation clicks: ${outfitGenerationClicks}`);

// Reset click counter if it's a new day
function resetClickCounterIfNeeded() {
  const today = new Date().toDateString();
  if (today !== lastClickResetDate) {
    console.log(`Day changed: Resetting outfit generation clicks from ${outfitGenerationClicks} to 0`);
    outfitGenerationClicks = 0;
    lastClickResetDate = today;
    saveOutfitClicks(outfitGenerationClicks, lastClickResetDate);
  }
}

// Routes
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok' });
});

// Reload data from storage (useful after seeding)
app.post('/api/reload', (req, res) => {
  try {
    console.log('Reloading data from storage...');
    const freshData = loadWardrobeData();
    wardrobeItems = freshData.items;
    outfitGenerationClicks = freshData.outfitGenerationClicks;
    lastClickResetDate = freshData.lastClickResetDate;
    userProfile = freshData.userProfile || {};
    
    console.log(`Reloaded ${wardrobeItems.length} items from storage`);
    res.json({ 
      message: 'Data reloaded successfully',
      itemsCount: wardrobeItems.length,
      clicksUsed: outfitGenerationClicks
    });
  } catch (error) {
    console.error('Error reloading data:', error);
    res.status(500).json({ error: 'Failed to reload data' });
  }
});

// Get all wardrobe items
app.get('/api/items', (req, res) => {
  console.log(`Returning ${wardrobeItems.length} wardrobe items`);
  wardrobeItems.forEach((item, index) => {
    console.log(`  Item ${index + 1}: "${item.title}" (ID: ${item.id}, Category: ${item.category})`);
  });
  res.json(wardrobeItems);
});

// Get items grouped by category
app.get('/api/items/by-category', (req, res) => {
  const grouped = wardrobeItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, WardrobeItem[]>);
  
  const categoryCount = Object.keys(grouped).length;
  console.log(`Returning items grouped by ${categoryCount} categories`);
  res.json(grouped);
});

// Upload photo and create item
app.post('/api/items', upload.single('photo'), async (req, res) => {
  try {
    console.log('Creating new wardrobe item...');
    
    if (!req.file) {
      console.error('No photo uploaded');
      return res.status(400).json({ error: 'No photo uploaded' });
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

    console.log(`Processing item: "${title}"`);
    console.log(`  Category: ${category}`);
    console.log(`  File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);

    const imageUrl = `/uploads/${req.file.filename}`;
    
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
      imageUrl,
      category,
      description: description || undefined,
      measurements: parsedMeasurements,
      createdAt: new Date().toISOString()
    };

    // Log current items before adding
    console.log(`Current items before adding: ${wardrobeItems.length}`);
    wardrobeItems.forEach((item, index) => {
      console.log(`  Item ${index + 1}: "${item.title}" (ID: ${item.id})`);
    });
    
    wardrobeItems.push(newItem);
    console.log(`Item created successfully. Total items: ${wardrobeItems.length}`);
    console.log(`New item ID: ${newItem.id}, Title: "${newItem.title}"`);

    // Log all items after adding
    wardrobeItems.forEach((item, index) => {
      console.log(`  Item ${index + 1}: "${item.title}" (ID: ${item.id})`);
    });

    // Save to persistent storage
    saveItems(wardrobeItems);

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
    console.log('Generating outfit combinations...');
    resetClickCounterIfNeeded();

    if (outfitGenerationClicks >= MAX_OUTFIT_CLICKS_PER_DAY) {
      console.log(`Daily limit reached: ${outfitGenerationClicks}/${MAX_OUTFIT_CLICKS_PER_DAY} clicks used`);
      return res.status(429).json({ 
        error: 'Daily limit reached. Please try again tomorrow.',
        clicksUsed: outfitGenerationClicks,
        maxClicks: MAX_OUTFIT_CLICKS_PER_DAY
      });
    }

    // Group items by category
    const itemsByCategory = wardrobeItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WardrobeItem[]>);

    // Check if we have enough items in different categories
    const categoryCount = Object.keys(itemsByCategory).length;
    console.log(`Items grouped into ${categoryCount} categories`);
    
    Object.entries(itemsByCategory).forEach(([category, items]) => {
      console.log(`  ${category}: ${items.length} items`);
    });

    if (categoryCount < 2) {
      console.log(`Not enough categories: ${categoryCount} (need at least 2)`);
      return res.status(400).json({ 
        error: 'Need at least 2 different categories to generate outfits',
        categories: categoryCount
      });
    }

    // Generate outfits using LLM with user profile and item descriptions
    console.log('Calling LLM to generate outfit combinations...');
    console.log(`User profile: Height ${userProfile.height || 'N/A'} ${userProfile.heightUnit || ''}, Weight ${userProfile.weight || 'N/A'} ${userProfile.weightUnit || ''}`);
    const outfits = await generateOutfits(itemsByCategory, userProfile);
    console.log(`Generated ${outfits.length} outfit combinations`);
    
    outfitGenerationClicks++;
    console.log(`Outfit generation clicks: ${outfitGenerationClicks}/${MAX_OUTFIT_CLICKS_PER_DAY}`);
    
    // Save to persistent storage
    saveOutfitClicks(outfitGenerationClicks, lastClickResetDate);

    res.json({
      outfits,
      clicksUsed: outfitGenerationClicks,
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
app.get('/api/outfits/status', (req, res) => {
  resetClickCounterIfNeeded();
  const status = {
    clicksUsed: outfitGenerationClicks,
    maxClicks: MAX_OUTFIT_CLICKS_PER_DAY,
    remaining: MAX_OUTFIT_CLICKS_PER_DAY - outfitGenerationClicks
  };
  console.log(`Outfit generation status: ${status.clicksUsed}/${status.maxClicks} clicks used, ${status.remaining} remaining`);
  res.json(status);
});

// Delete an item
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  console.log(`Deleting item with ID: ${id}`);
  
  const itemIndex = wardrobeItems.findIndex(item => item.id === id);
  
  if (itemIndex === -1) {
    console.log(`Item not found: ${id}`);
    return res.status(404).json({ error: 'Item not found' });
  }

  const item = wardrobeItems[itemIndex];
  console.log(`Deleting item: "${item.title}" (${item.category})`);
  
  // Delete the file
  const filePath = path.join(__dirname, '../uploads', path.basename(item.imageUrl));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Deleted file: ${filePath}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }

  wardrobeItems.splice(itemIndex, 1);
  console.log(`Item deleted. Total items: ${wardrobeItems.length}`);
  
  // Save to persistent storage
  saveItems(wardrobeItems);
  
  res.json({ message: 'Item deleted successfully' });
});

// Get user profile
app.get('/api/user/profile', (req, res) => {
  console.log('Fetching user profile');
  res.json(userProfile);
});

// Update user profile
app.post('/api/user/profile', (req, res) => {
  try {
    const { height, weight, heightUnit, weightUnit } = req.body;
    
    userProfile = {
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      heightUnit: heightUnit || 'inches',
      weightUnit: weightUnit || 'lbs'
    };
    
    console.log('Updated user profile:', userProfile);
    saveUserProfile(userProfile);
    
    res.json(userProfile);
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

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log('='.repeat(50));
});
