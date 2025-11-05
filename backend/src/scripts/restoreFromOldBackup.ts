import fs from 'fs';
import path from 'path';
import { loadWardrobeData, saveWardrobeData, UserData } from '../storage';

const BACKUP_FILE = path.join(__dirname, '../../data/wardrobe.json.backup.1762284844839');
const TARGET_USER_NAME = 'Sruti';

console.log('Restoring data from old backup format...');

try {
  // Load the old backup (single-user format)
  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
  const oldData = JSON.parse(backupContent);

  console.log(`Backup contains:`);
  console.log(`  - Items: ${oldData.items?.length || 0}`);
  console.log(`  - Saved Outfits: ${oldData.savedOutfits?.length || 0}`);
  console.log(`  - Outfit Feedback: ${oldData.outfitFeedback?.length || 0}`);
  console.log(`  - User Profile: ${oldData.userProfile ? 'Yes' : 'No'}`);

  // Load current data
  const currentData = loadWardrobeData();

  // IMPORTANT: Preserve existing users! Only restore Sruti's data
  console.log(`\n⚠️  Preserving existing users:`);
  const existingUsers = currentData.userList.filter(u => u.name !== TARGET_USER_NAME);
  existingUsers.forEach(u => {
    const ud = currentData.users[u.id];
    console.log(`  - ${u.name}: ${ud?.items?.length || 0} items, ${ud?.savedOutfits?.length || 0} outfits`);
  });

  // Find or create Sruti user
  let srutiUser = currentData.userList.find(u => u.name === TARGET_USER_NAME);
  
  if (!srutiUser) {
    // Create Sruti user
    srutiUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: TARGET_USER_NAME,
      createdAt: new Date().toISOString()
    };
    currentData.userList.push(srutiUser);
    console.log(`\nCreated new user: ${srutiUser.name} (${srutiUser.id})`);
  } else {
    console.log(`\nFound existing user: ${srutiUser.name} (${srutiUser.id})`);
  }

  // Restore data for Sruti ONLY (preserve other users' data)
  currentData.users[srutiUser.id] = {
    items: oldData.items || [],
    outfitGenerationClicks: oldData.outfitGenerationClicks || 0,
    lastClickResetDate: oldData.lastClickResetDate || new Date().toDateString(),
    userProfile: oldData.userProfile || {},
    savedOutfits: oldData.savedOutfits || [],
    outfitFeedback: oldData.outfitFeedback || [],
    exploreSuggestions: oldData.exploreSuggestions || [],
    lastExploreUpdate: oldData.lastExploreUpdate || ''
  };

  // IMPORTANT: Preserve all existing users' data
  existingUsers.forEach(u => {
    if (currentData.users[u.id]) {
      // Keep existing user data
      console.log(`Preserved ${u.name}'s data: ${currentData.users[u.id].items?.length || 0} items`);
    }
  });

  // Save restored data
  saveWardrobeData(currentData);

  console.log('\n✅ Restored data successfully!');
  console.log(`   - User: ${srutiUser.name}`);
  console.log(`   - Items: ${currentData.users[srutiUser.id].items.length}`);
  console.log(`   - Saved Outfits: ${currentData.users[srutiUser.id].savedOutfits?.length || 0}`);
  console.log(`   - Outfit Feedback: ${currentData.users[srutiUser.id].outfitFeedback?.length || 0}`);
} catch (error) {
  console.error('❌ Error restoring data:', error);
  process.exit(1);
}

