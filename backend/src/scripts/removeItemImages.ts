import fs from 'fs';
import path from 'path';

// Get the correct path - __dirname in ts-node points to the scripts directory
const DATA_FILE = path.join(__dirname, '../../data/wardrobe.json');

interface WardrobeItem {
  id: string;
  title: string;
  imageUrl?: string;
  category: string;
  description?: string;
  measurements?: any;
  createdAt: string;
}

interface WardrobeData {
  items: WardrobeItem[];
  outfitGenerationClicks?: number;
  lastClickResetDate?: string;
  userProfile?: any;
  savedOutfits?: any[];
  outfitFeedback?: any[];
  exploreSuggestions?: any[];
  lastExploreUpdate?: string;
}

function removeItemImages() {
  try {
    console.log('Loading wardrobe data...');
    
    if (!fs.existsSync(DATA_FILE)) {
      console.log('❌ Data file not found:', DATA_FILE);
      process.exit(1);
    }
    
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const data: WardrobeData = JSON.parse(fileContent);
    
    console.log(`Found ${data.items.length} items`);
    
    // Remove imageUrl from all items
    let removedCount = 0;
    data.items = data.items.map(item => {
      if (item.imageUrl) {
        removedCount++;
        const { imageUrl, ...itemWithoutImage } = item;
        return itemWithoutImage;
      }
      return item;
    });
    
    console.log(`Removed imageUrl from ${removedCount} items`);
    
    // Create backup before saving
    if (fs.existsSync(DATA_FILE)) {
      const backupFile = `${DATA_FILE}.backup.${Date.now()}`;
      fs.copyFileSync(DATA_FILE, backupFile);
      console.log(`Created backup: ${backupFile}`);
    }
    
    // Save updated data
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log('✅ Successfully removed imageUrl from all wardrobe items');
    console.log(`Items now using placeholder images based on category`);
  } catch (error) {
    console.error('❌ Error removing item images:', error);
    process.exit(1);
  }
}

removeItemImages();

