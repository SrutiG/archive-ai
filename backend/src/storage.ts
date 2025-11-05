import fs from 'fs';
import path from 'path';
import lockfile from 'proper-lockfile';
import { WardrobeItem, UserProfile, OutfitFeedback, ExploreSuggestion } from './index';

const DATA_FILE = path.join(__dirname, '../data/wardrobe.json');
const DATA_DIR = path.join(__dirname, '../data');
const LOCK_FILE = `${DATA_FILE}.lock`;
const BACKUP_DIR = path.join(__dirname, '../data/backups');

// Ensure backup directory exists
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('Created backups directory');
  }
}

// Create a timestamped backup that will never be overwritten
function createTimestampedBackup(data: WardrobeData): string {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `wardrobe-${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Created timestamped backup: ${path.basename(backupFile)}`);
  return backupFile;
}

// Validate data before saving - prevent saving empty/invalid data
function validateDataBeforeSave(data: WardrobeData): boolean {
  const newUserCount = data.userList?.length || 0;
  const newItemCount = Object.values(data.users || {}).reduce(
    (sum: number, ud: any) => sum + (ud?.items?.length || 0), 0
  );
  
  // Never save completely empty data if we have existing data
  const existingFile = fs.existsSync(DATA_FILE);
  if (existingFile) {
    try {
      const existingContent = fs.readFileSync(DATA_FILE, 'utf-8');
      if (existingContent.trim().length > 50) { // Existing file has substantial data
        const existingData = JSON.parse(existingContent);
        const existingUserCount = existingData.userList?.length || 0;
        const existingItemCount = Object.values(existingData.users || {}).reduce(
          (sum: number, ud: any) => sum + (ud?.items?.length || 0), 0
        );
        
        // If we're about to lose all users or all items, prevent save
        if (existingUserCount > 0 && newUserCount === 0) {
          console.error('❌ BLOCKED: Attempted to save empty user list when existing data has users');
          return false;
        }
        
        if (existingItemCount > 10 && newItemCount === 0) {
          console.error('❌ BLOCKED: Attempted to save zero items when existing data has many items');
          return false;
        }
      }
    } catch (e) {
      // If we can't read existing file, allow save (might be corrupted)
      console.warn('Could not validate against existing file:', e);
    }
  }
  
  // CRITICAL: Also check if we're trying to save empty data when file already has empty structure
  // This prevents overwriting valid data with empty data
  if (existingFile && newUserCount === 0 && newItemCount === 0) {
    try {
      const existingContent = fs.readFileSync(DATA_FILE, 'utf-8');
      const existingData = JSON.parse(existingContent);
      const existingUserCount = existingData.userList?.length || 0;
      const existingItemCount = Object.values(existingData.users || {}).reduce(
        (sum: number, ud: any) => sum + (ud?.items?.length || 0), 0
      );
      
      // If existing data has users or items, but we're trying to save empty, block it
      if (existingUserCount > 0 || existingItemCount > 0) {
        console.error('❌ BLOCKED: Attempted to overwrite non-empty data with empty data');
        console.error(`   Existing: ${existingUserCount} users, ${existingItemCount} items`);
        console.error(`   New: ${newUserCount} users, ${newItemCount} items`);
        return false;
      }
    } catch (e) {
      // If we can't read, allow save
    }
  }
  
  return true;
}

export interface User {
  id: string;
  name: string;
  createdAt: string;
}

export interface UserData {
  items: WardrobeItem[];
  outfitGenerationClicks: number;
  lastClickResetDate: string;
  userProfile?: UserProfile;
  savedOutfits?: SavedOutfit[];
  outfitFeedback?: OutfitFeedback[];
  exploreSuggestions?: ExploreSuggestion[];
  lastExploreUpdate?: string;
}

export interface WardrobeData {
  users: Record<string, UserData>;
  userList: User[];
}

export interface SavedOutfit {
  id: string;
  itemTitles: string[];
  createdAt: string;
  prompt?: string;
  notes?: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('Created data directory');
  }
}

function getDefaultUserData(): UserData {
  return {
    items: [],
    outfitGenerationClicks: 0,
    lastClickResetDate: new Date().toDateString(),
    userProfile: {},
    savedOutfits: [],
    outfitFeedback: [],
    exploreSuggestions: [],
    lastExploreUpdate: ''
  };
}

function getDefaultData(): WardrobeData {
  return {
    users: {},
    userList: []
  };
}

export function loadWardrobeData(): WardrobeData {
  let release: (() => void) | null = null;
  try {
    ensureDataDir();
    
    // Acquire lock before reading (with retry for lock contention)
    try {
      release = lockfile.lockSync(DATA_FILE, {
        lockfilePath: LOCK_FILE
      });
    } catch (lockError: any) {
      // If lock is held, wait a bit and try reading without lock
      if (lockError.code === 'ELOCKED') {
        console.warn('⚠️  Lock file is held, reading without lock (may be stale data)');
        // Try reading without lock
        if (fs.existsSync(DATA_FILE)) {
          const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
          const data = JSON.parse(fileContent);
          // Validate structure
          if (data.users && typeof data.users === 'object' && !Array.isArray(data.users)) {
            return data;
          }
        }
        return getDefaultData();
      }
      throw lockError;
    }
    
    if (!fs.existsSync(DATA_FILE)) {
      console.log('No existing data file found, starting with empty wardrobe');
      const defaultData = getDefaultData();
      // Don't save empty data - let first operation create it
      return defaultData;
    }

    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Check if this is old format (single user) and migrate
    if (data.items && Array.isArray(data.items)) {
      console.log('Migrating old single-user data format to multi-user format...');
      const userId = 'default-user';
      const migratedData: WardrobeData = {
        users: {
          [userId]: {
            items: data.items || [],
            outfitGenerationClicks: data.outfitGenerationClicks || 0,
            lastClickResetDate: data.lastClickResetDate || new Date().toDateString(),
            userProfile: data.userProfile || {},
            savedOutfits: data.savedOutfits || [],
            outfitFeedback: data.outfitFeedback || [],
            exploreSuggestions: data.exploreSuggestions || [],
            lastExploreUpdate: data.lastExploreUpdate || ''
          }
        },
        userList: [{
          id: userId,
          name: 'Default User',
          createdAt: new Date().toISOString()
        }]
      };
      
      // Create timestamped backup before migration (never overwritten)
      createTimestampedBackup(data as WardrobeData);
      
      // Also create rolling backup
      const backupFile = `${DATA_FILE}.backup.${Date.now()}`;
      fs.copyFileSync(DATA_FILE, backupFile);
      console.log(`Created backup before migration: ${backupFile}`);
      
      saveWardrobeDataUnlocked(migratedData, release);
      console.log('Migration complete. Created default user with existing data.');
      release = null; // Release already called
      return migratedData;
    }
    
    // Validate new multi-user structure
    if (!data.users || typeof data.users !== 'object') {
      console.error('❌ Invalid data structure detected!');
      // Create backup of corrupted data before handling
      try {
        createTimestampedBackup(data as WardrobeData);
        const corruptedBackup = `${DATA_FILE}.invalid.${Date.now()}`;
        fs.copyFileSync(DATA_FILE, corruptedBackup);
        console.error(`Created backup of invalid data: ${corruptedBackup}`);
      } catch (e) {
        console.error('Failed to backup invalid data:', e);
      }
      // DON'T overwrite with empty data - return what we have and let caller handle it
      console.error('⚠️  Returning invalid data structure - NOT overwriting with empty data');
      if (release) {
        try {
          release();
        } catch (e) {
          console.error('Error releasing lock:', e);
        }
      }
      return data as WardrobeData; // Return invalid data rather than empty data
    }

    if (!data.userList || !Array.isArray(data.userList)) {
      data.userList = [];
    }

    const totalItems = Object.values(data.users).reduce((sum: number, userData: any) => sum + (userData.items?.length || 0), 0);
    console.log(`Loaded data for ${data.userList.length} users with ${totalItems} total items`);
    
    return data;
  } catch (error: any) {
    // Check if this is a lock error (not actual corruption)
    if (error.code === 'ELOCKED') {
      console.warn('⚠️  Lock file is held, cannot read data');
      console.warn('   This is not a corruption error - the file is likely valid');
      if (release && typeof release === 'function') {
        try {
          release();
        } catch (releaseError) {
          console.error('Error releasing lock:', releaseError);
        }
      }
      // Try reading without lock as fallback
      if (fs.existsSync(DATA_FILE)) {
        try {
          const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
          const data = JSON.parse(fileContent);
          if (data.users && typeof data.users === 'object' && !Array.isArray(data.users)) {
            console.warn('   Successfully read data without lock');
            return data;
          }
        } catch (e) {
          console.error('   Failed to read without lock:', e);
        }
      }
      return getDefaultData();
    }
    
    // This is an actual error (parse error, file read error, etc.)
    console.error('❌ Error loading wardrobe data:', error.message || error);
    // CRITICAL: Don't overwrite existing data on parse errors!
    // Release lock if we have it
    if (release && typeof release === 'function') {
      try {
        release();
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
    // If file exists but is corrupted, try to create a timestamped backup
    if (fs.existsSync(DATA_FILE)) {
      try {
        const corruptedBackup = `${DATA_FILE}.corrupted.${Date.now()}`;
        fs.copyFileSync(DATA_FILE, corruptedBackup);
        console.error(`Created backup of corrupted file: ${corruptedBackup}`);
      } catch (backupError) {
        console.error('Failed to backup corrupted file:', backupError);
      }
    }
    // Return empty data but DON'T save it - let the caller decide what to do
    console.error('WARNING: Returning empty data structure due to load error');
    console.error('Existing data file may be corrupted. Check backup files.');
    return getDefaultData();
  }
}

// Internal function that saves without acquiring a lock (assumes lock already held)
function saveWardrobeDataUnlocked(data: WardrobeData, release: (() => void) | null): void {
  try {
    ensureDataDir();
    
    // CRITICAL: Validate before saving to prevent data loss
    if (!validateDataBeforeSave(data)) {
      throw new Error('Save blocked: Data validation failed - would cause data loss');
    }
    
    // Load existing data to create proper backup
    if (fs.existsSync(DATA_FILE)) {
      try {
        const existingContent = fs.readFileSync(DATA_FILE, 'utf-8');
        const existingData = JSON.parse(existingContent);
        
        // Create timestamped backup (never overwritten)
        createTimestampedBackup(existingData);
        
        // Also update rolling backup
        const backupFile = `${DATA_FILE}.backup`;
        fs.copyFileSync(DATA_FILE, backupFile);
      } catch (e) {
        console.warn('Could not create backup from existing file:', e);
      }
    }
    
    // Write to temporary file first, then rename (atomic operation)
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
    
    const totalItems = Object.values(data.users).reduce((sum: number, userData: any) => sum + (userData.items?.length || 0), 0);
    console.log(`Saved data for ${data.userList.length} users with ${totalItems} total items`);
    
    // Release lock after successful write
    if (release) {
      release();
    }
  } catch (error) {
    // Release lock on error
    if (release && typeof release === 'function') {
      try {
        release();
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
    console.error('Error saving wardrobe data:', error);
    throw error;
  }
}

// Public function that acquires lock before saving
export function saveWardrobeData(data: WardrobeData): void {
  let release: (() => void) | null = null;
  try {
    ensureDataDir();
    
    // Acquire lock before writing
    release = lockfile.lockSync(DATA_FILE, {
      lockfilePath: LOCK_FILE
    });
    
    saveWardrobeDataUnlocked(data, release);
    release = null; // Already released in saveWardrobeDataUnlocked
  } catch (error) {
    // Release lock on error
    if (release && typeof release === 'function') {
      try {
        release();
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
    console.error('Error saving wardrobe data:', error);
    throw error;
  }
}

function getUserData(userId: string): UserData {
  let release: (() => void) | null = null;
  try {
    ensureDataDir();
    
    // Acquire lock for read-modify-write operation
    release = lockfile.lockSync(DATA_FILE, {
      lockfilePath: LOCK_FILE
    });
    
    const data = loadWardrobeDataUnlocked(release);
    if (!data.users[userId]) {
      data.users[userId] = getDefaultUserData();
      saveWardrobeDataUnlocked(data, release);
      release = null; // Already released
    } else {
      // Release lock if we didn't save
      if (release) {
        release();
        release = null;
      }
    }
    return data.users[userId];
  } catch (error) {
    if (release && typeof release === 'function') {
      try {
        release();
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
    throw error;
  }
}

function saveUserData(userId: string, userData: UserData): void {
  let release: (() => void) | null = null;
  try {
    ensureDataDir();
    
    // Acquire lock for read-modify-write operation
    release = lockfile.lockSync(DATA_FILE, {
      lockfilePath: LOCK_FILE
    });
    
    const data = loadWardrobeDataUnlocked(release);
    data.users[userId] = userData;
    saveWardrobeDataUnlocked(data, release);
    release = null; // Already released
  } catch (error) {
    if (release && typeof release === 'function') {
      try {
        release();
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
    throw error;
  }
}

// Internal function that loads without acquiring a lock (assumes lock already held)
function loadWardrobeDataUnlocked(release: (() => void) | null): WardrobeData {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.log('No existing data file found, starting with empty wardrobe');
      const defaultData = getDefaultData();
      // Don't save empty data - let first operation create it
      return defaultData;
    }

    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Check if this is old format (single user) and migrate
    if (data.items && Array.isArray(data.items)) {
      console.log('Migrating old single-user data format to multi-user format...');
      const userId = 'default-user';
      const migratedData: WardrobeData = {
        users: {
          [userId]: {
            items: data.items || [],
            outfitGenerationClicks: data.outfitGenerationClicks || 0,
            lastClickResetDate: data.lastClickResetDate || new Date().toDateString(),
            userProfile: data.userProfile || {},
            savedOutfits: data.savedOutfits || [],
            outfitFeedback: data.outfitFeedback || [],
            exploreSuggestions: data.exploreSuggestions || [],
            lastExploreUpdate: data.lastExploreUpdate || ''
          }
        },
        userList: [{
          id: userId,
          name: 'Default User',
          createdAt: new Date().toISOString()
        }]
      };
      
      // Create backup before migration
      const backupFile = `${DATA_FILE}.backup.${Date.now()}`;
      fs.copyFileSync(DATA_FILE, backupFile);
      console.log(`Created backup before migration: ${backupFile}`);
      
      saveWardrobeDataUnlocked(migratedData, release);
      console.log('Migration complete. Created default user with existing data.');
      return migratedData;
    }
    
    // Validate new multi-user structure
    if (!data.users || typeof data.users !== 'object') {
      console.error('❌ Invalid data structure detected in loadWardrobeDataUnlocked!');
      // Create backup of corrupted data
      try {
        createTimestampedBackup(data as WardrobeData);
        const corruptedBackup = `${DATA_FILE}.invalid.${Date.now()}`;
        fs.copyFileSync(DATA_FILE, corruptedBackup);
        console.error(`Created backup of invalid data: ${corruptedBackup}`);
      } catch (e) {
        console.error('Failed to backup invalid data:', e);
      }
      // DON'T overwrite - return what we have
      console.error('⚠️  Returning invalid data structure - NOT overwriting with empty data');
      return data as WardrobeData;
    }

    if (!data.userList || !Array.isArray(data.userList)) {
      data.userList = [];
    }

    const totalItems = Object.values(data.users).reduce((sum: number, userData: any) => sum + (userData.items?.length || 0), 0);
    console.log(`Loaded data for ${data.userList.length} users with ${totalItems} total items`);
    
    return data;
  } catch (error) {
    console.error('Error loading wardrobe data:', error);
    // CRITICAL: Don't overwrite existing data on parse errors!
    // Create backup of corrupted file if it exists
    if (fs.existsSync(DATA_FILE)) {
      try {
        const corruptedBackup = `${DATA_FILE}.corrupted.${Date.now()}`;
        fs.copyFileSync(DATA_FILE, corruptedBackup);
        console.error(`Created backup of corrupted file: ${corruptedBackup}`);
      } catch (backupError) {
        console.error('Failed to backup corrupted file:', backupError);
      }
    }
    // Return empty data but DON'T save it - let the caller decide
    console.error('WARNING: Returning empty data structure due to load error');
    console.error('Existing data file may be corrupted. Check backup files.');
    return getDefaultData();
  }
}

export function saveItems(userId: string, items: WardrobeItem[]): void {
  const userData = getUserData(userId);
  userData.items = items;
  saveUserData(userId, userData);
}

export function saveOutfitClicks(userId: string, clicks: number, lastResetDate: string): void {
  const userData = getUserData(userId);
  userData.outfitGenerationClicks = clicks;
  userData.lastClickResetDate = lastResetDate;
  saveUserData(userId, userData);
}

export function saveUserProfile(userId: string, profile: UserProfile): void {
  const userData = getUserData(userId);
  userData.userProfile = profile;
  saveUserData(userId, userData);
}

export function saveOutfits(userId: string, outfits: SavedOutfit[]): void {
  const userData = getUserData(userId);
  userData.savedOutfits = outfits;
  saveUserData(userId, userData);
}

export function saveFeedback(userId: string, feedback: OutfitFeedback[]): void {
  const userData = getUserData(userId);
  userData.outfitFeedback = feedback;
  saveUserData(userId, userData);
}

export function saveExploreSuggestions(userId: string, suggestions: ExploreSuggestion[], updateDate: string): void {
  const userData = getUserData(userId);
  userData.exploreSuggestions = suggestions;
  userData.lastExploreUpdate = updateDate;
  saveUserData(userId, userData);
}

export function getAllUsers(): User[] {
  let release: (() => void) | null = null;
  try {
    ensureDataDir();
    
    // Acquire lock for read
    release = lockfile.lockSync(DATA_FILE, {
      lockfilePath: LOCK_FILE
    });
    
    const data = loadWardrobeDataUnlocked(release);
    if (release) {
      release();
    }
    return data.userList || [];
  } catch (error) {
    if (release && typeof release === 'function') {
      try {
        release();
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
    console.error('Error getting all users:', error);
    return [];
  }
}

export function createUser(name: string): User {
  let release: (() => void) | null = null;
  try {
    ensureDataDir();
    
    // Acquire lock for read-modify-write operation
    release = lockfile.lockSync(DATA_FILE, {
      lockfilePath: LOCK_FILE
    });
    
    const data = loadWardrobeDataUnlocked(release);
    const newUser: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      createdAt: new Date().toISOString()
    };
    
    data.userList.push(newUser);
    data.users[newUser.id] = getDefaultUserData();
    saveWardrobeDataUnlocked(data, release);
    release = null; // Already released
    
    console.log(`Created new user: ${newUser.name} (${newUser.id})`);
    return newUser;
  } catch (error) {
    if (release && typeof release === 'function') {
      try {
        release();
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
    throw error;
  }
}

export function getUserById(userId: string): User | null {
  let release: (() => void) | null = null;
  try {
    ensureDataDir();
    
    // Acquire lock for read
    release = lockfile.lockSync(DATA_FILE, {
      lockfilePath: LOCK_FILE
    });
    
    const data = loadWardrobeDataUnlocked(release);
    if (release) {
      release();
    }
    return data.userList.find(u => u.id === userId) || null;
  } catch (error) {
    if (release && typeof release === 'function') {
      try {
        release();
      } catch (releaseError) {
        console.error('Error releasing lock:', releaseError);
      }
    }
    console.error('Error getting user by ID:', error);
    return null;
  }
}

