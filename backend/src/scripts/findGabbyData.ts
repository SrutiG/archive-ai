import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../../data');

console.log('🔍 Searching for Gabby\'s data in all backup files...\n');

// Check all files in data directory
const files = fs.readdirSync(DATA_DIR)
  .filter(f => f.endsWith('.json') || f.includes('backup') || f.includes('corrupted') || f.includes('restore'))
  .sort()
  .reverse();

let found = false;

for (const file of files) {
  try {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Skip if file is too small (likely empty)
    if (content.trim().length < 100) continue;
    
    const data = JSON.parse(content);
    
    // Check multi-user format
    if (data.userList && Array.isArray(data.userList)) {
      const gabby = data.userList.find((u: any) => 
        u.name && (u.name.toLowerCase().includes('gabby') || 
                   u.name.toLowerCase().includes('gabri') ||
                   u.name.toLowerCase().includes('gab'))
      );
      
      if (gabby) {
        const userData = data.users?.[gabby.id];
        console.log(`✅ Found Gabby in ${file}:`);
        console.log(`   ID: ${gabby.id}`);
        console.log(`   Items: ${userData?.items?.length || 0}`);
        console.log(`   Saved Outfits: ${userData?.savedOutfits?.length || 0}`);
        console.log(`   Feedback: ${userData?.outfitFeedback?.length || 0}`);
        console.log(`   Profile: ${userData?.userProfile ? 'Yes' : 'No'}`);
        found = true;
      }
      
      // Also list all non-Sruti users
      const otherUsers = data.userList.filter((u: any) => u.name && u.name !== 'Sruti');
      if (otherUsers.length > 0 && !found) {
        console.log(`\n📋 Found other users in ${file}:`);
        otherUsers.forEach((u: any) => {
          const ud = data.users?.[u.id];
          console.log(`   - ${u.name} (${u.id}): ${ud?.items?.length || 0} items`);
        });
      }
    }
  } catch (e) {
    // Skip files that can't be parsed
  }
}

if (!found) {
  console.log('❌ Gabby\'s data not found in any backup files');
  console.log('\n📁 All backup files checked:');
  files.forEach(f => {
    try {
      const stats = fs.statSync(path.join(DATA_DIR, f));
      console.log(`   - ${f} (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (e) {}
  });
}

