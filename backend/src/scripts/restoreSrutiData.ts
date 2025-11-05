import fs from 'fs';
import path from 'path';

const BACKUP_FILE = path.join(__dirname, '../../data/wardrobe.json.backup.1762284844839');
const DATA_FILE = path.join(__dirname, '../../data/wardrobe.json');
const TARGET_USER_NAME = 'Sruti';

console.log('🔧 Restoring Sruti\'s data (direct file write to bypass locks)...\n');

try {
  // Load the old backup (single-user format)
  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
  const oldData = JSON.parse(backupContent);

  console.log(`📦 Backup contains:`);
  console.log(`   - Items: ${oldData.items?.length || 0}`);
  console.log(`   - Saved Outfits: ${oldData.savedOutfits?.length || 0}`);
  console.log(`   - Outfit Feedback: ${oldData.outfitFeedback?.length || 0}`);
  console.log(`   - User Profile: ${oldData.userProfile ? 'Yes' : 'No'}`);

  // Load current data directly (bypass locks)
  let currentData: any = { users: {}, userList: [] };
  if (fs.existsSync(DATA_FILE)) {
    try {
      const currentContent = fs.readFileSync(DATA_FILE, 'utf-8');
      if (currentContent.trim().length > 10) {
        currentData = JSON.parse(currentContent);
        console.log(`\n📋 Current database has ${currentData.userList?.length || 0} users`);
      }
    } catch (e) {
      console.warn('⚠️  Could not parse current data, starting fresh:', e);
    }
  }

  // Find or create Sruti user
  let srutiUser = currentData.userList?.find((u: any) => u.name === TARGET_USER_NAME);
  
  if (!srutiUser) {
    // Create Sruti user
    srutiUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: TARGET_USER_NAME,
      createdAt: new Date().toISOString()
    };
    if (!currentData.userList) {
      currentData.userList = [];
    }
    currentData.userList.push(srutiUser);
    console.log(`\n✅ Created new user: ${srutiUser.name} (${srutiUser.id})`);
  } else {
    console.log(`\n✅ Found existing user: ${srutiUser.name} (${srutiUser.id})`);
  }

  // Ensure users object exists
  if (!currentData.users) {
    currentData.users = {};
  }

  // Restore data for Sruti
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

  // Create backup of current file before overwriting
  if (fs.existsSync(DATA_FILE)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, '../../data/backups', `wardrobe-before-restore-${timestamp}.json`);
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    fs.copyFileSync(DATA_FILE, backupPath);
    console.log(`\n💾 Created backup: ${path.basename(backupPath)}`);
  }

  // Write directly to file (bypass locks)
  const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(currentData, null, 2), 'utf-8');
  fs.renameSync(tempFile, DATA_FILE);

  console.log('\n✅ Restored data successfully!');
  console.log(`   - User: ${srutiUser.name} (${srutiUser.id})`);
  console.log(`   - Items: ${currentData.users[srutiUser.id].items.length}`);
  console.log(`   - Saved Outfits: ${currentData.users[srutiUser.id].savedOutfits?.length || 0}`);
  console.log(`   - Outfit Feedback: ${currentData.users[srutiUser.id].outfitFeedback?.length || 0}`);
  console.log(`   - Profile Fields: ${Object.keys(currentData.users[srutiUser.id].userProfile || {}).length}`);
  
  // Show profile summary
  const profile = currentData.users[srutiUser.id].userProfile || {};
  if (Object.keys(profile).length > 0) {
    console.log(`\n📋 Profile Summary:`);
    if (profile.height) console.log(`   - Height: ${profile.height}"`);
    if (profile.weight) console.log(`   - Weight: ${profile.weight} lbs`);
    if (profile.stylePreferences) console.log(`   - Style: ${profile.stylePreferences.substring(0, 60)}...`);
    if (profile.favoriteBrands?.length) console.log(`   - Brands: ${profile.favoriteBrands.length} brands`);
  }
  
} catch (error) {
  console.error('❌ Error restoring data:', error);
  process.exit(1);
}

