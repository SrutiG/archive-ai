import fs from 'fs';
import path from 'path';
import { loadWardrobeData, saveWardrobeData, WardrobeData } from '../storage';

const DATA_FILE = path.join(__dirname, '../../data/wardrobe.json');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const TARGET_USER_NAME = 'Sruti';

console.log(`Fixing image URLs for user "${TARGET_USER_NAME}"...`);

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

  // Get all files in uploads directory
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`Uploads directory not found: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(UPLOADS_DIR);
  console.log(`Found ${allFiles.length} files in uploads directory`);

  // Get current user data
  const userData = currentData.users[targetUser.id];
  if (!userData) {
    console.error(`User data not found for ${targetUser.name}`);
    process.exit(1);
  }

  // Normalize title for matching (lowercase, remove special chars but keep hyphens, spaces to hyphens)
  // Handle special characters like ü -> u
  const normalizeTitle = (title: string): string => {
    return title
      .toLowerCase()
      .normalize('NFD')  // Decompose characters (ü -> u + ̈)
      .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, '')  // Keep hyphens, remove other special chars
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // Extract title from filename (remove UUID prefix)
  const extractTitleFromFile = (filename: string): string => {
    const baseName = path.basename(filename, path.extname(filename));
    const parts = baseName.split('-');
    // UUID is typically 5 parts (format: xxxxx-xxxx-xxxx-xxxx-xxxxx-title)
    // Try to find where the actual title starts by looking for common words
    if (parts.length > 5) {
      // Skip UUID parts (first 5 parts)
      return parts.slice(5).join('-');
    } else if (parts.length > 4) {
      // Fallback: skip first 4 parts
      return parts.slice(4).join('-');
    }
    return baseName;
  };

  // Fix imageUrl for items that should have images
  let fixedCount = 0;
  let notFoundCount = 0;
  
  const itemsWithImages = [
    'Deadwood Hiro Leather Jacket',
    'Ann Demeulemeester Eggplant Leather Blazer',
    "Wilson's Leather Trench",
    'Stüssy Dragon Sherpa',
    'Peter Do Half Suede-Half Leather Shirt Jacket',
    'Peter Do Combat Boots',
    'Ganni Chunky Chelsea Boots'
  ];

  // Manual mapping for items with special characters that don't match well
  const manualMappings: Record<string, string> = {
    'Stüssy Dragon Sherpa': '337370f3-258c-4fa4-8a45-a813bfcb6ebd-st-ssy-dragon-sherpa.png'
  };

  userData.items.forEach(item => {
    // Only process items that should have images
    if (itemsWithImages.includes(item.title)) {
      // Check manual mapping first
      let matchingFile: string | null = manualMappings[item.title] || null;
      
      if (!matchingFile) {
        const normalizedItemTitle = normalizeTitle(item.title);
        
        // Search through all files
        for (const file of allFiles) {
          const fileTitle = extractTitleFromFile(file);
          const normalizedFileTitle = normalizeTitle(fileTitle);
          
          // Check if they match (either exact or partial)
          if (normalizedItemTitle === normalizedFileTitle) {
            matchingFile = file;
            break;
          } else {
            // Partial match - check if significant words match
            // Only do partial match if we haven't found an exact match yet
            const itemWords = normalizedItemTitle.split('-').filter(w => w.length > 3);
            const fileWords = normalizedFileTitle.split('-').filter(w => w.length > 3);
            
            // Count matching words (exact match or substring)
            const matchingWords = itemWords.filter(itemWord => 
              fileWords.some(fileWord => fileWord === itemWord || fileWord.includes(itemWord) || itemWord.includes(fileWord))
            );
            
            // Require at least 3 matching words for partial match (more strict)
            if (matchingWords.length >= Math.min(3, itemWords.length)) {
              // Only use this match if we haven't found one yet, or if this one has more matches
              if (!matchingFile || matchingWords.length > 3) {
                matchingFile = file;
              }
            }
          }
        }
      }

      if (matchingFile) {
        item.imageUrl = `/uploads/${matchingFile}`;
        fixedCount++;
        console.log(`  ✓ Fixed: ${item.title} -> ${matchingFile}`);
      } else {
        notFoundCount++;
        const normalizedTitle = normalizeTitle(item.title);
        console.log(`  ✗ Not found: ${item.title} (normalized: ${normalizedTitle})`);
        // Remove imageUrl if file doesn't exist
        delete item.imageUrl;
      }
    }
  });

  // Save updated data
  currentData.users[targetUser.id] = userData;
  saveWardrobeData(currentData);

  console.log('\n✅ Image URL fix complete!');
  console.log(`   - Fixed: ${fixedCount} items`);
  console.log(`   - Not found: ${notFoundCount} items (removed imageUrl)`);

} catch (error) {
  console.error('❌ Error fixing image URLs:', error);
  process.exit(1);
}

