import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { WardrobeItem, UserProfile } from '../index';
import * as db from '../database';

const DATA_DIR = path.join(__dirname, '../../data');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// Create a simple placeholder image (1x1 pixel PNG)
function createPlaceholderImage(filePath: string): void {
  const minimalPNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(filePath, minimalPNG);
}

// Generate a unique image filename
function generateImageFilename(itemTitle: string): string {
  const sanitized = itemTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${uuidv4()}-${sanitized}.png`;
}

function getSeedData(): { items: WardrobeItem[], userProfile: UserProfile } {
  const now = new Date().toISOString();
  
  // User profile: 5'2" (62 inches) and 124.7 lbs with style preferences
  const userProfile: UserProfile = {
    height: 62,
    weight: 124.7,
    heightUnit: 'inches',
    weightUnit: 'lbs',
    stylePreferences: "avant garde, feminine, all black. I like to elongate my silhouette with a cropped or tucked shirt with long pants and high heeled or platform shoes.",
    brands: [
      "Maison Margiela",
      "Rick Owens",
      "Ann Demeulemeester",
      "Junya Watanabe",
      "Yohji Yamamoto",
      "Comme des Garçons",
      "Issey Miyake"
    ],
    waist: 26,
    inseam: 28,
    shoeSize: "8",
    measurementsUnit: "inches",
    hairColor: "Black",
    hairTexture: "Curly - 2C",
    skinColor: "Tan"
  };
  
  // Don't delete existing images - preserve user's photos!
  // The seed script will only create placeholder images for items that don't have images

  // Item templates based on actual wardrobe
  const itemTemplates: Array<Omit<WardrobeItem, 'id' | 'imageUrl'>> = [
    // JACKETS / OUTERWEAR
    {
      title: 'Deadwood Hiro Leather Jacket',
      category: 'Outerwear',
      description: 'Boxy, oversized leather jacket, hits just below hip. Heavy leather. Pairs well with cropped knits, fitted trousers, Guidi or Ganni boots. Use case: Daily / Statement. Weighty leather, masculine cut but works well over feminine tops.',
      measurements: { size: 'S', chest: 36, length: 24 },
      createdAt: now
    },
    {
      title: 'Ann Demeulemeester Eggplant Leather Blazer',
      category: 'Outerwear',
      description: 'Eggplant (dark purple) leather blazer. Slightly fitted, hits at or below hip. Tailored statement piece. Pairs well with silk shirts, wide trousers, Margiela heels. Use case: Dressy / Evening. Adds polish and subtle color depth.',
      measurements: { size: 'S', chest: 36, length: 26 },
      createdAt: now
    },
    {
      title: "Wilson's Leather Trench",
      category: 'Outerwear',
      description: 'Long structured trench coat with lining. Heavy outerwear. Pairs well with ribbed bodysuits, heels or boots. Use case: Cold weather / Dressy casual. Warm, classic silhouette.',
      measurements: { size: 'S', chest: 36, length: 40 },
      createdAt: now
    },
    {
      title: 'Stüssy Dragon Sherpa',
      category: 'Outerwear',
      description: 'Reversible sherpa jacket with dragon print. Oversized fit. Casual / Street style. Pairs well with Vuori joggers, CHNGE hoodie, sneakers. Use case: Off-duty / Dog walks. Statement print, adds texture.',
      measurements: { size: 'M', chest: 40, length: 28 },
      createdAt: now
    },
    {
      title: 'Junya Watanabe Cropped Nylon Jacket',
      category: 'Outerwear',
      description: 'Cropped nylon jacket, slightly masculine fit. Techwear / Fashion category. Pairs well with corset tops, wide pants, platform boots. Use case: Mild weather / Statement. Light but sculptural.',
      measurements: { size: 'S', chest: 36, length: 20 },
      createdAt: now
    },
    {
      title: 'Nothing Written Wool Coat',
      category: 'Outerwear',
      description: 'Mid-length wool coat with lapels. Classic wool outerwear. Pairs well with ribbed tops, trousers, Tabi heels. Use case: Work / Dressy. Sleek minimal tailoring.',
      measurements: { size: 'S', chest: 36, length: 34 },
      createdAt: now
    },
    {
      title: 'Peter Do Half Suede-Half Leather Shirt Jacket',
      category: 'Outerwear',
      description: 'Half suede, half leather shirt jacket. Belted, upper-thigh length. Hybrid statement piece. Pairs well with fitted tanks, trousers, heels. Use case: Transitional seasons. Strong waist definition.',
      measurements: { size: 'S', chest: 36, length: 28 },
      createdAt: now
    },
    {
      title: 'Cav Empt Hoodie',
      category: 'Outerwear',
      description: 'Heavy cotton hoodie. Regular length. Sweatshirt category. Pairs well with wide trousers, joggers, sneakers. Use case: Daily / Street. Excellent fabric, under-stated embroidery, ideal reference for future fits.',
      measurements: { size: 'M', chest: 38 },
      createdAt: now
    },
    {
      title: 'Peter Do Crewneck Sweatshirt',
      category: 'Tops',
      description: 'Crewneck sweatshirt with stripe sleeves. Relaxed fit. Sweatshirt category. Pairs well with tailored trousers, boots. Use case: Smart casual.',
      measurements: { size: 'M', chest: 38 },
      createdAt: now
    },
    {
      title: 'Everlane Long Army-Green Trench',
      category: 'Outerwear',
      description: 'Army green trench coat. Oversized, long fit. Functional category. Pairs well with fitted tops, boots. Use case: Rainy days.',
      measurements: { size: 'M', chest: 40, length: 42 },
      createdAt: now
    },

    // TOPS
    {
      title: 'Peter Do Fitted Button-Up',
      category: 'Tops',
      description: 'White stripe fitted button-up shirt. Tailored, structured fit. Shirt category. Pairs well with pleated trousers, Tabis. Use case: Office / Dressy.',
      measurements: { size: 'S', chest: 36, length: 26 },
      createdAt: now
    },
    {
      title: 'Peter Do Silk Collarless Button-Up',
      category: 'Tops',
      description: 'Silk collarless button-up shirt. Slim, drapey fit. Silk shirt category. Pairs well with leather trousers, heels.',
      measurements: { size: 'S', chest: 36, length: 26 },
      createdAt: now
    },
    {
      title: 'Peter Do Silk Scarf Shirt',
      category: 'Tops',
      description: 'Silk shirt with attached scarf. Flowy with attached scarf. Statement top category. Pairs well with fitted pants, structured blazers.',
      measurements: { size: 'S', chest: 36 },
      createdAt: now
    },
    {
      title: 'Dion Lee Corset Collared Shirt',
      category: 'Tops',
      description: 'Cropped corset collared shirt. Cropped, sculpted fit. Corset / Shirt hybrid. Pairs well with wide trousers, blazers, boots.',
      measurements: { size: 'S', chest: 36, length: 22 },
      createdAt: now
    },
    {
      title: 'Ann Demeulemeester Mohair Sweater',
      category: 'Tops',
      description: 'Mohair sweater with gold stripes. Relaxed fit. Knitwear category. Pairs well with leather skirts, structured trousers. Notes: Fragile — limit wear.',
      measurements: { size: 'S', chest: 38 },
      createdAt: now
    },
    {
      title: 'Rick Owens V-Neck Sweater',
      category: 'Tops',
      description: 'V-neck sweater. Slim fit. Knit category. Pairs well with bias pants, midi skirts.',
      measurements: { size: 'S', chest: 36 },
      createdAt: now
    },
    {
      title: 'Peter Do Ribbed Short-Sleeve',
      category: 'Tops',
      description: 'Ribbed short-sleeve top. Tight, waist length fit. Base layer category. Pairs well with all tailored trousers or skirts.',
      measurements: { size: 'S', chest: 34, length: 22 },
      createdAt: now
    },
    {
      title: 'Peter Do Ribbed Long-Sleeve',
      category: 'Tops',
      description: 'Ribbed long-sleeve top. Tight, waist length fit. Base layer category. Pairs well with all tailored trousers or skirts.',
      measurements: { size: 'S', chest: 34, length: 22 },
      createdAt: now
    },
    {
      title: 'Dion Lee Corset Tank',
      category: 'Tops',
      description: 'Structured corset tank. Corset category. Pairs well with wide-leg pants, heels.',
      measurements: { size: 'S', chest: 34 },
      createdAt: now
    },
    {
      title: 'Everlane Ribbed Turtleneck LS',
      category: 'Tops',
      description: 'Ribbed long-sleeve turtleneck. Fitted. Base layer category. Pairs well with wool coats, wide trousers.',
      measurements: { size: 'S', chest: 34 },
      createdAt: now
    },
    {
      title: 'Everlane Ribbed Mock-Neck Tank',
      category: 'Tops',
      description: 'Ribbed mock-neck tank. Slim, cropped fit. Base layer category. Pairs well with blazers, leather jackets.',
      measurements: { size: 'S', chest: 34 },
      createdAt: now
    },
    {
      title: 'Alyx Cropped Graphic Mock-Neck Tee',
      category: 'Tops',
      description: 'Cropped graphic mock-neck t-shirt. Cropped fit. Tee category. Pairs well with cargo or high-waist trousers.',
      measurements: { size: 'S', chest: 34, length: 20 },
      createdAt: now
    },
    {
      title: 'Everlane Bodysuit Boat Neck',
      category: 'Tops',
      description: 'Boat neck bodysuit. Fitted. Base layer / Lingerie category. Pairs well with skirts, trousers, blazers.',
      measurements: { size: 'S', chest: 34 },
      createdAt: now
    },
    {
      title: 'Everlane Bodysuit V-Neck',
      category: 'Tops',
      description: 'V-neck bodysuit. Fitted. Base layer / Lingerie category. Pairs well with skirts, trousers, blazers.',
      measurements: { size: 'S', chest: 34 },
      createdAt: now
    },
    {
      title: 'Everlane Bodysuit Lace Camisole',
      category: 'Tops',
      description: 'Lace camisole bodysuit. Fitted. Base layer / Lingerie category. Pairs well with skirts, trousers, blazers.',
      measurements: { size: 'S', chest: 34 },
      createdAt: now
    },
    {
      title: 'Vuori Tank',
      category: 'Tops',
      description: 'Vuori tank top. Various cuts. Active / Casual category. Pairs well with joggers, CHNGE hoodie.',
      measurements: { size: 'S' },
      createdAt: now
    },
    {
      title: 'Vuori Long Sleeve',
      category: 'Tops',
      description: 'Vuori long-sleeve top. Various cuts. Active / Casual category. Pairs well with joggers, CHNGE hoodie.',
      measurements: { size: 'S', chest: 36 },
      createdAt: now
    },

    // BOTTOMS
    {
      title: 'Banana Republic Pleated Flare Trousers',
      category: 'Bottoms',
      description: 'Pleated flare trousers. Boot-cut fit. Tailored category. Pairs well with fitted tops, cropped jackets.',
      measurements: { size: '4', waist: 28, inseam: 29 },
      createdAt: now
    },
    {
      title: 'Banana Republic Wide-Leg Pleated Trousers',
      category: 'Bottoms',
      description: 'Wide-leg pleated trousers. Wide fit. Tailored category. Pairs well with cropped sweaters, blazers.',
      measurements: { size: '4', waist: 28, inseam: 29 },
      createdAt: now
    },
    {
      title: 'Peter Do x BR Extra-Wide Belted Trousers',
      category: 'Bottoms',
      description: 'Extra-wide belted trousers. Ultra-wide, belted fit. Statement category. Pairs well with cropped shirts, platforms.',
      measurements: { size: '4', waist: 28, inseam: 29 },
      createdAt: now
    },
    {
      title: 'MM6 Trousers',
      category: 'Bottoms',
      description: 'Tailored trousers. Designer basics category.',
      measurements: { size: '4', waist: 28, inseam: 29 },
      createdAt: now
    },
    {
      title: 'Everlane Canvas Pants',
      category: 'Bottoms',
      description: 'Wide straight canvas pants. Casual structured fit. Casual category. Pairs well with hoodies, sneakers.',
      measurements: { size: '4', waist: 28, inseam: 29 },
      createdAt: now
    },
    {
      title: 'Rick Owens Bias Pants',
      category: 'Bottoms',
      description: 'Bias-cut pants. Wide, drapey fit. Avant-Garde category. Notes: Needs repair; beautiful movement.',
      measurements: { size: '4', waist: 28 },
      createdAt: now
    },
    {
      title: 'Yohji Yamamoto Metallic Gray Overalls',
      category: 'Bottoms',
      description: 'Metallic gray overalls. Barrel-cut wide fit. Statement category.',
      measurements: { size: 'S', waist: 28 },
      createdAt: now
    },
    {
      title: 'Mugler Mesh Skirt w/ Slit',
      category: 'Bottoms',
      description: 'Mesh skirt with slit. Slim, semi-sheer fit. Evening category.',
      measurements: { size: 'S', waist: 28, length: 24 },
      createdAt: now
    },
    {
      title: 'Black Skirt w/ White Lining',
      category: 'Bottoms',
      description: 'Black A-line skirt with white lining. Loose fit (needs tailoring).',
      measurements: { size: 'S', waist: 28, length: 26 },
      createdAt: now
    },
    {
      title: 'Ralph Lauren A-Line Navy Skirt',
      category: 'Bottoms',
      description: 'Navy A-line skirt. Long fit. Vintage / Occasional category.',
      measurements: { size: 'S', waist: 28, length: 32 },
      createdAt: now
    },
    {
      title: 'Rick Owens Skirt w/ Train',
      category: 'Bottoms',
      description: 'Skirt with train. Slim, asymmetric back fit. Statement category. Tailored.',
      measurements: { size: 'S', waist: 28, length: 36 },
      createdAt: now
    },
    {
      title: 'Pleated Mini Skirt',
      category: 'Bottoms',
      description: 'Gray pleated mini skirt. Short fit. Playful contrast category.',
      measurements: { size: 'S', waist: 28, length: 16 },
      createdAt: now
    },
    {
      title: 'Vuori Lounge Pants',
      category: 'Bottoms',
      description: 'Lounge pants. Relaxed fit. Lounge / Active category.',
      measurements: { size: 'S', waist: 27 },
      createdAt: now
    },
    {
      title: 'Vuori Joggers',
      category: 'Bottoms',
      description: 'Joggers. Relaxed fit. Lounge / Active category.',
      measurements: { size: 'S', waist: 27 },
      createdAt: now
    },
    {
      title: 'Lululemon Joggers',
      category: 'Bottoms',
      description: 'Joggers. Relaxed fit. Lounge / Active category.',
      measurements: { size: 'S', waist: 27 },
      createdAt: now
    },
    {
      title: 'Linen Shorts',
      category: 'Bottoms',
      description: 'Linen shorts. Lightweight fit. Casual summer category.',
      measurements: { size: 'S', waist: 27, length: 5 },
      createdAt: now
    },
    {
      title: 'Bearded Goat Shorts',
      category: 'Bottoms',
      description: 'Casual shorts. Use case: Active / Warm weather.',
      measurements: { size: 'S', waist: 27, length: 5 },
      createdAt: now
    },

    // SHOES
    {
      title: 'Rick Owens Bozo Boots',
      category: 'Shoes',
      description: 'Clear sole bozo boots. Statement boot category. Notes: In repair; anchor shoe.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Guidi PL2 Boots',
      category: 'Shoes',
      description: 'PL2 boots. Staple boot category. Use case: Daily / Statement.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Peter Do Combat Boots',
      category: 'Shoes',
      description: 'Combat boots. Hybrid fashion boot category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Ganni Chunky Chelsea Boots',
      category: 'Shoes',
      description: 'Chunky Chelsea boots. Functional / Everyday category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Trippen Knee-High Wedge Boots',
      category: 'Shoes',
      description: 'Knee-high wedge boots. Statement / Comfort category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Margiela Heeled Tabis',
      category: 'Shoes',
      description: 'Heeled Tabi boots. Dress shoe category. Use case: Events.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Peter Do 9" Platform Heels',
      category: 'Shoes',
      description: '9 inch platform heels. Runway / Event category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Ann D Knee-High Stilettos',
      category: 'Shoes',
      description: 'Knee-high stiletto boots. Dress boot category. Uncomfortable.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Acne Studios Heeled Mules',
      category: 'Shoes',
      description: 'Heeled mules. Dress shoe category. Uncomfortable.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'By Far Kitten Heels',
      category: 'Shoes',
      description: 'Kitten heels. Dress shoe category. Uncomfortable.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Naturalizer 6" Platforms',
      category: 'Shoes',
      description: '6 inch platform heels. Statement heels category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Stüssy x Nike Spiridon',
      category: 'Shoes',
      description: 'Cream colored Spiridon sneakers. Casual sneaker category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Tom Sachs General Purpose Shoe',
      category: 'Shoes',
      description: 'White General Purpose Shoe. Minimal sneaker category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Jordan 4 A Ma Manière',
      category: 'Shoes',
      description: 'Violet Jordan 4 sneakers. Streetwear sneaker category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Birkenstocks',
      category: 'Shoes',
      description: 'Brown Birkenstocks. Lounge / Summer category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },
    {
      title: 'Salomon Trail Runners',
      category: 'Shoes',
      description: 'Trail running shoes. Utility sneaker category.',
      measurements: { shoeSize: '7' },
      createdAt: now
    },

    // ACCESSORIES / BAGS
    {
      title: 'MM6 Triangle Bag',
      category: 'Bags',
      description: 'Triangle shaped bag. Pairs well with dressy fits. Notes: Feminine shape; silk scarf accent adds subtle color.',
      measurements: { size: 'Medium' },
      createdAt: now
    },
    {
      title: 'Alyx Crossbody',
      category: 'Bags',
      description: 'Crossbody bag. Use case: Utility / Daily.',
      measurements: { size: 'Small' },
      createdAt: now
    },
    {
      title: 'Everlane Sling Bag',
      category: 'Bags',
      description: 'Sling bag. Use case: Dog walks / Errands.',
      measurements: { size: 'Small' },
      createdAt: now
    },
    {
      title: 'TUMI Voyager Tote',
      category: 'Bags',
      description: 'Voyager tote bag. Use case: Work / Travel.',
      measurements: { size: 'Large' },
      createdAt: now
    },

    // JEWELRY
    {
      title: 'Graedance Silver Neck Cuff',
      category: 'Jewelry',
      description: 'Silver neck cuff. Statement jewelry. Pairs well with ribbed tops, open collars.',
      createdAt: now
    },
    {
      title: 'Silver Pendant Necklace',
      category: 'Jewelry',
      description: 'Silver pendant necklace. Minimal jewelry category.',
      createdAt: now
    },
    {
      title: 'Cone-Spike Chain Necklace',
      category: 'Jewelry',
      description: 'Cone-spike chain necklace. Edge accent jewelry category.',
      createdAt: now
    },
    {
      title: 'Silver Cuffs',
      category: 'Jewelry',
      description: 'Silver cuffs bracelets. Various widths.',
      createdAt: now
    },
    {
      title: 'Silver Rings',
      category: 'Jewelry',
      description: 'Assorted silver rings. Minimal / Abstract category.',
      createdAt: now
    }
  ];

  // Create items with IDs - only add imageUrl if file doesn't exist
  // This preserves existing photos while allowing new items to have placeholders
  const items: WardrobeItem[] = itemTemplates.map(template => {
    const item: WardrobeItem = {
      id: uuidv4(),
      ...template
    };
    
    // Only create placeholder image if it doesn't already exist
    // This way we don't overwrite existing photos
    const filename = generateImageFilename(template.title);
    const imagePath = path.join(UPLOADS_DIR, filename);
    
    if (!fs.existsSync(imagePath)) {
      // Only create placeholder if file doesn't exist
      createPlaceholderImage(imagePath);
      item.imageUrl = `/uploads/${filename}`;
    }
    // If file exists, don't set imageUrl - item will use category placeholder
    
    return item;
  });

  return { items, userProfile };
}

const TARGET_USER_NAME = 'Sruti';

console.log(`Seeding wardrobe data for user "${TARGET_USER_NAME}"...`);

try {
  ensureDataDir();

  // Find or create the target user in database
  let targetUser = db.getAllUsers().find(u => u.name === TARGET_USER_NAME);
  
  if (!targetUser) {
    // Create new user
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    targetUser = db.createUser(id, TARGET_USER_NAME, createdAt);
    console.log(`   Created new user: ${targetUser.name} (${targetUser.id})`);
  } else {
    console.log(`   Found existing user: ${targetUser.name} (${targetUser.id})`);
    
    // Clear existing items for this user (optional - comment out if you want to preserve)
    const existingItems = db.getItemsByUser(targetUser.id);
    if (existingItems.length > 0) {
      console.log(`   Clearing ${existingItems.length} existing items for user...`);
      for (const item of existingItems) {
        db.deleteItem(item.id);
      }
    }
    
    // Clear saved outfits and feedback (optional - comment out if you want to preserve)
    const savedOutfits = db.getSavedOutfits(targetUser.id);
    const feedback = db.getFeedback(targetUser.id);
    if (savedOutfits.length > 0 || feedback.length > 0) {
      console.log(`   Clearing ${savedOutfits.length} saved outfits and ${feedback.length} feedback entries...`);
      for (const outfit of savedOutfits) {
        db.deleteSavedOutfit(outfit.id);
      }
      for (const fb of feedback) {
        db.deleteFeedback(fb.id);
      }
    }
  }

  // Get seed data
  const { items, userProfile } = getSeedData();
  
  // Insert items into database
  console.log(`   Inserting ${items.length} items into database...`);
  for (const item of items) {
    db.insertItem(item, targetUser.id);
  }
  
  // Update user profile
  db.upsertProfile(targetUser.id, userProfile);
  
  // Reset user data (outfit clicks)
  db.updateUserData(targetUser.id, 0, new Date().toDateString());
  
  const itemsWithImages = items.filter(i => i.imageUrl).length;
  const itemsWithoutImages = items.length - itemsWithImages;
  
  console.log('✅ Database seeded successfully!');
  console.log(`   - Added ${items.length} items for user "${TARGET_USER_NAME}"`);
  console.log(`   - Created ${itemsWithImages} placeholder image files in uploads/`);
  if (itemsWithoutImages > 0) {
    console.log(`   - ${itemsWithoutImages} items preserved existing photos (no imageUrl set)`);
  }
  console.log(`   - User profile: ${userProfile.height}" height, ${userProfile.weight} lbs`);
  console.log(`   - Style preferences and brands updated`);
  console.log(`   - Categories: ${[...new Set(items.map(i => i.category))].join(', ')}`);
  console.log(`   - Reset: Saved outfits and feedback have been cleared for this user`);
  console.log(`   - Note: Existing photos were preserved and not deleted`);
} catch (error) {
  console.error('❌ Error seeding data:', error);
  process.exit(1);
}
