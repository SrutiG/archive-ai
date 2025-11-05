import fs from 'fs';
import path from 'path';
import { loadWardrobeData, saveWardrobeData, WardrobeData } from '../storage';

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
  [key: string]: any;
}

console.log(`Fixing item images for user "${TARGET_USER_NAME}"...`);

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

  // Fix imageUrl for items: only keep if it existed in backup, otherwise remove
  let itemsWithPhotos = 0;
  let itemsWithoutPhotos = 0;
  
  userData.items.forEach(item => {
    const oldItem = oldItemsByTitle.get(item.title);
    if (oldItem && oldItem.imageUrl) {
      // Keep the imageUrl from backup
      item.imageUrl = oldItem.imageUrl;
      itemsWithPhotos++;
      console.log(`  ✓ Photo kept: ${item.title}`);
    } else {
      // Remove imageUrl so it falls back to placeholder
      delete item.imageUrl;
      itemsWithoutPhotos++;
      console.log(`  - Photo removed (will use placeholder): ${item.title}`);
    }
  });

  // Save updated data
  currentData.users[targetUser.id] = userData;
  saveWardrobeData(currentData);

  console.log('\n✅ Image restoration complete!');
  console.log(`   - Items with photos: ${itemsWithPhotos}`);
  console.log(`   - Items without photos (using placeholders): ${itemsWithoutPhotos}`);
  console.log(`   - Total items: ${userData.items.length}`);

} catch (error) {
  console.error('❌ Error fixing item images:', error);
  process.exit(1);
}

