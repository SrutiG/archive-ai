import fs from 'fs';
import path from 'path';

// Get the correct path - __dirname in ts-node points to the scripts directory
const DATA_FILE = path.join(__dirname, '../../data/wardrobe.json');

interface WardrobeData {
  items: any[];
  outfitGenerationClicks: number;
  lastClickResetDate: string;
  userProfile?: any;
  savedOutfits?: any[];
  outfitFeedback?: any[];
  exploreSuggestions?: any[];
  lastExploreUpdate?: string;
}

function resetOutfitClicks() {
  try {
    console.log('Loading wardrobe data...');
    
    if (!fs.existsSync(DATA_FILE)) {
      console.log('❌ Data file not found:', DATA_FILE);
      process.exit(1);
    }
    
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const data: WardrobeData = JSON.parse(fileContent);
    
    const currentClicks = data.outfitGenerationClicks;
    const today = new Date().toDateString();
    
    console.log(`Current outfit generation clicks: ${currentClicks}`);
    console.log(`Current reset date: ${data.lastClickResetDate}`);
    console.log(`Today's date: ${today}`);
    
    // Reset clicks to 0 and update the reset date to today
    data.outfitGenerationClicks = 0;
    data.lastClickResetDate = today;
    
    console.log(`Resetting clicks to 0 for today (${today})`);
    
    // Create backup before saving
    if (fs.existsSync(DATA_FILE)) {
      const backupFile = `${DATA_FILE}.backup.${Date.now()}`;
      fs.copyFileSync(DATA_FILE, backupFile);
      console.log(`Created backup: ${backupFile}`);
    }
    
    // Save updated data
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log('✅ Successfully reset outfit generation clicks to 0');
    console.log(`You now have 10 clicks remaining for today`);
  } catch (error) {
    console.error('❌ Error resetting outfit clicks:', error);
    process.exit(1);
  }
}

resetOutfitClicks();

