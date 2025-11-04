import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(__dirname, '../../data/wardrobe.json');
const DATA_DIR = path.join(__dirname, '../../data');

console.log('Clearing wardrobe data...');

try {
  // Remove data file if it exists
  if (fs.existsSync(DATA_FILE)) {
    fs.unlinkSync(DATA_FILE);
    console.log('✅ Deleted wardrobe.json');
  } else {
    console.log('ℹ️  No data file found');
  }

  // Remove backup file if it exists
  const backupFile = `${DATA_FILE}.backup`;
  if (fs.existsSync(backupFile)) {
    fs.unlinkSync(backupFile);
    console.log('✅ Deleted wardrobe.json.backup');
  }

  // Remove uploads directory contents (optional - images)
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
    console.log(`✅ Deleted ${files.length} uploaded images`);
  }

  console.log('✅ Data store cleared successfully!');
} catch (error) {
  console.error('❌ Error clearing data store:', error);
  process.exit(1);
}

