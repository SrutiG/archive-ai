import fs from 'fs';
import path from 'path';
import { WardrobeItem, UserProfile } from './index';

const DATA_FILE = path.join(__dirname, '../data/wardrobe.json');
const DATA_DIR = path.join(__dirname, '../data');

export interface WardrobeData {
  items: WardrobeItem[];
  outfitGenerationClicks: number;
  lastClickResetDate: string;
  userProfile?: UserProfile;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('Created data directory');
  }
}

function getDefaultData(): WardrobeData {
  return {
    items: [],
    outfitGenerationClicks: 0,
    lastClickResetDate: new Date().toDateString(),
    userProfile: {}
  };
}

export function loadWardrobeData(): WardrobeData {
  try {
    ensureDataDir();
    
    if (!fs.existsSync(DATA_FILE)) {
      console.log('No existing data file found, starting with empty wardrobe');
      const defaultData = getDefaultData();
      saveWardrobeData(defaultData);
      return defaultData;
    }

    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(fileContent) as WardrobeData;
    
    // Validate data structure
    if (!data.items || !Array.isArray(data.items)) {
      console.log('Invalid data structure, resetting to default');
      const defaultData = getDefaultData();
      saveWardrobeData(defaultData);
      return defaultData;
    }

    console.log(`Loaded ${data.items.length} items from storage`);
    console.log(`Outfit generation clicks: ${data.outfitGenerationClicks}`);
    
    return data;
  } catch (error) {
    console.error('Error loading wardrobe data:', error);
    console.log('Starting with empty wardrobe due to load error');
    const defaultData = getDefaultData();
    saveWardrobeData(defaultData);
    return defaultData;
  }
}

export function saveWardrobeData(data: WardrobeData): void {
  try {
    ensureDataDir();
    
    // Create backup before saving
    if (fs.existsSync(DATA_FILE)) {
      const backupFile = `${DATA_FILE}.backup`;
      fs.copyFileSync(DATA_FILE, backupFile);
    }
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved ${data.items.length} items to storage`);
  } catch (error) {
    console.error('Error saving wardrobe data:', error);
    throw error;
  }
}

export function saveItems(items: WardrobeItem[]): void {
  const currentData = loadWardrobeData();
  currentData.items = items;
  saveWardrobeData(currentData);
}

export function saveOutfitClicks(clicks: number, lastResetDate: string): void {
  const currentData = loadWardrobeData();
  currentData.outfitGenerationClicks = clicks;
  currentData.lastClickResetDate = lastResetDate;
  saveWardrobeData(currentData);
}

export function saveUserProfile(profile: UserProfile): void {
  const currentData = loadWardrobeData();
  currentData.userProfile = profile;
  saveWardrobeData(currentData);
}

