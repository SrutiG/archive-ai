import fs from 'fs';
import path from 'path';
import { loadWardrobeData, saveWardrobeData, WardrobeData, UserData } from '../storage';

const DATA_FILE = path.join(__dirname, '../../data/wardrobe.json');
const BACKUP_FILE = path.join(__dirname, '../../data/wardrobe.json.backup.1762289952303');
const TARGET_USER_NAME = 'Sruti';

interface OldItem {
  id: string;
  title: string;
  imageUrl?: string;
  [key: string]: any;
}

interface OldData {
  items: OldItem[];
  savedOutfits?: any[];
  outfitFeedback?: any[];
  [key: string]: any;
}

console.log(`Restoring data for user "${TARGET_USER_NAME}"...`);

try {
  // Load current data
  const currentData: WardrobeData = loadWardrobeData();
  
  // Find target user
  const targetUser = currentData.userList.find(u => u.name === TARGET_USER_NAME);
  if (!targetUser) {
    console.error(`User "${TARGET_USER_NAME}" not found!`);
    process.exit(1);
  }

  console.log(`Found user: ${targetUser.name} (${targetUser.id})`);

  // Load backup data
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`Backup file not found: ${BACKUP_FILE}`);
    process.exit(1);
  }

  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
  const oldData: OldData = JSON.parse(backupContent);

  console.log(`Loaded backup with ${oldData.items.length} items`);
  console.log(`  Saved outfits: ${oldData.savedOutfits?.length || 0}`);
  console.log(`  Feedback: ${oldData.outfitFeedback?.length || 0}`);

  // Create a map of old items by title for quick lookup
  const oldItemsByTitle = new Map<string, OldItem>();
  oldData.items.forEach(item => {
    oldItemsByTitle.set(item.title, item);
  });

  // Get current user data
  const userData = currentData.users[targetUser.id];
  if (!userData) {
    console.error(`User data not found for ${targetUser.name}`);
    process.exit(1);
  }

  // Restore imageUrl for items by matching title
  let restoredImages = 0;
  userData.items.forEach(item => {
    const oldItem = oldItemsByTitle.get(item.title);
    if (oldItem && oldItem.imageUrl) {
      item.imageUrl = oldItem.imageUrl;
      restoredImages++;
      console.log(`  Restored image for: ${item.title}`);
    }
  });

  // Restore saved outfits
  if (oldData.savedOutfits && oldData.savedOutfits.length > 0) {
    userData.savedOutfits = oldData.savedOutfits;
    console.log(`  Restored ${oldData.savedOutfits.length} saved outfits`);
  }

  // Restore feedback
  if (oldData.outfitFeedback && oldData.outfitFeedback.length > 0) {
    userData.outfitFeedback = oldData.outfitFeedback;
    console.log(`  Restored ${oldData.outfitFeedback.length} feedback entries`);
  }

  // Save updated data
  currentData.users[targetUser.id] = userData;
  saveWardrobeData(currentData);

  console.log('✅ Data restoration complete!');
  console.log(`   - Restored images for ${restoredImages} items`);
  console.log(`   - Restored ${userData.savedOutfits?.length || 0} saved outfits`);
  console.log(`   - Restored ${userData.outfitFeedback?.length || 0} feedback entries`);

} catch (error) {
  console.error('❌ Error restoring data:', error);
  process.exit(1);
}

