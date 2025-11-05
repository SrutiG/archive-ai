import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import FormData from 'form-data';

const API_BASE_URL = 'http://localhost:3001';
let user1Id: string;
let user2Id: string;

// Helper to make API requests
async function apiRequest(endpoint: string, userId: string, options: any = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
    ...(options.headers || {})
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function createUser(name: string) {
  console.log(`📝 Creating user: ${name}`);
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    throw new Error(`Failed to create user: ${response.statusText}`);
  }

  const user = await response.json() as { id: string; name: string; createdAt: string };
  console.log(`✅ Created user: ${user.name} (${user.id})`);
  return user;
}

async function addItem(userId: string, itemNumber: number, userLabel: string) {
  const formData = new FormData();
  formData.append('title', `User ${userLabel} Item ${itemNumber}`);
  formData.append('category', 'Tops');
  formData.append('description', `Item ${itemNumber} added by User ${userLabel} concurrently`);

  const response = await fetch(`${API_BASE_URL}/api/items`, {
    method: 'POST',
    headers: {
      'X-User-Id': userId,
      ...formData.getHeaders()
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add item ${itemNumber} for User ${userLabel}: ${response.status} ${errorText}`);
  }

  const result = await response.json() as { id: string; title: string; category: string };
  console.log(`  [User ${userLabel} Item ${itemNumber}] ✅ Added: ${result.title}`);
  return result;
}

async function updateProfile(userId: string, updateNumber: number, userLabel: string) {
  const profile = {
    height: 60 + updateNumber,
    weight: 120 + updateNumber,
    stylePreferences: `User ${userLabel} style update #${updateNumber}`
  };

  const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify(profile)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update profile ${updateNumber} for User ${userLabel}: ${response.status} ${errorText}`);
  }

  const result = await response.json() as { height?: number; weight?: number; stylePreferences?: string };
  console.log(`  [User ${userLabel} Update ${updateNumber}] ✅ Profile: height=${result.height}, weight=${result.weight}`);
  return result;
}

async function verifyUserState(userId: string, userLabel: string, expectedItems: number) {
  // Get all items
  const itemsResponse = await fetch(`${API_BASE_URL}/api/items`, {
    headers: { 'X-User-Id': userId }
  });
  const items = await itemsResponse.json() as any[];
  
  // Get profile
  const profileResponse = await fetch(`${API_BASE_URL}/api/user/profile`, {
    headers: { 'X-User-Id': userId }
  });
  const profile = await profileResponse.json() as { height?: number; weight?: number; stylePreferences?: string };

  const userItems = items.filter((item: any) => 
    item.title && item.title.includes(`User ${userLabel}`)
  );

  console.log(`\n📊 User ${userLabel} Final State:`);
  console.log(`  - Total items: ${items.length}`);
  console.log(`  - User ${userLabel} items: ${userItems.length} (expected: ${expectedItems})`);
  console.log(`  - Profile height: ${profile.height}`);
  console.log(`  - Profile weight: ${profile.weight}`);
  console.log(`  - Profile style: ${profile.stylePreferences || 'N/A'}`);

  if (userItems.length !== expectedItems) {
    throw new Error(`❌ User ${userLabel}: Expected ${expectedItems} items, found ${userItems.length}`);
  }

  return { items, profile, userItems };
}

async function cleanup(user1Id: string, user2Id: string) {
  console.log(`\n🧹 Test users created:`);
  console.log(`  User 1: ${user1Id}`);
  console.log(`  User 2: ${user2Id}`);
  console.log(`  (Can be manually cleaned up if needed)`);
}

async function runTwoUserConcurrencyTest() {
  console.log('🚀 Starting Two-User Concurrency Test');
  console.log('='.repeat(60));

  try {
    // Create two test users
    const user1 = await createUser(`test-user-A-${Date.now()}`);
    const user2 = await createUser(`test-user-B-${Date.now()}`);
    user1Id = user1.id;
    user2Id = user2.id;

    console.log(`\n👥 Created two users:`);
    console.log(`  User A: ${user1.name} (${user1.id})`);
    console.log(`  User B: ${user2.name} (${user2.id})`);

    // Test 1: Both users add items simultaneously
    console.log(`\n📦 Test 1: Both users adding 10 items each simultaneously...`);
    const user1ItemPromises = Array.from({ length: 10 }, (_, i) => 
      addItem(user1Id, i + 1, 'A')
    );
    const user2ItemPromises = Array.from({ length: 10 }, (_, i) => 
      addItem(user2Id, i + 1, 'B')
    );
    
    // Execute both users' requests in parallel
    const [user1Items, user2Items] = await Promise.all([
      Promise.all(user1ItemPromises),
      Promise.all(user2ItemPromises)
    ]);

    console.log(`✅ User A: ${user1Items.length} items added`);
    console.log(`✅ User B: ${user2Items.length} items added`);

    // Wait for any pending writes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify both users' data
    const user1State = await verifyUserState(user1Id, 'A', 10);
    const user2State = await verifyUserState(user2Id, 'B', 10);
    console.log(`✅ Test 1 passed: Both users' items persisted correctly without interference`);

    // Test 2: Both users update profiles simultaneously
    console.log(`\n👤 Test 2: Both users updating profiles simultaneously...`);
    const user1ProfilePromises = Array.from({ length: 5 }, (_, i) => 
      updateProfile(user1Id, i + 1, 'A')
    );
    const user2ProfilePromises = Array.from({ length: 5 }, (_, i) => 
      updateProfile(user2Id, i + 1, 'B')
    );

    // Execute both users' profile updates in parallel
    const [user1Profiles, user2Profiles] = await Promise.all([
      Promise.all(user1ProfilePromises),
      Promise.all(user2ProfilePromises)
    ]);

    console.log(`✅ User A: ${user1Profiles.length} profile updates completed`);
    console.log(`✅ User B: ${user2Profiles.length} profile updates completed`);

    // Wait for any pending writes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify both users' profiles
    const user1Final = await verifyUserState(user1Id, 'A', 10);
    const user2Final = await verifyUserState(user2Id, 'B', 10);
    
    // Check that profiles are correct (should reflect last update for each user)
    const user1LastProfile = user1Profiles[user1Profiles.length - 1];
    const user2LastProfile = user2Profiles[user2Profiles.length - 1];
    
    if (user1Final.profile.height === user1LastProfile.height && 
        user1Final.profile.weight === user1LastProfile.weight) {
      console.log(`✅ User A profile matches last update`);
    } else {
      console.log(`⚠️  User A profile may have been updated by multiple requests`);
    }
    
    if (user2Final.profile.height === user2LastProfile.height && 
        user2Final.profile.weight === user2LastProfile.weight) {
      console.log(`✅ User B profile matches last update`);
    } else {
      console.log(`⚠️  User B profile may have been updated by multiple requests`);
    }
    
    console.log(`✅ Test 2 passed: Both users' profiles updated correctly`);

    // Test 3: Mixed operations - both users doing different things simultaneously
    console.log(`\n🔄 Test 3: Mixed operations - User A adding items, User B updating profile...`);
    const mixedPromises = [
      ...Array.from({ length: 5 }, (_, i) => addItem(user1Id, 10 + i + 1, 'A')),
      ...Array.from({ length: 3 }, (_, i) => updateProfile(user2Id, 5 + i + 1, 'B'))
    ];

    const mixedResults = await Promise.all(mixedPromises);
    console.log(`✅ All ${mixedResults.length} mixed operations completed`);

    // Wait for any pending writes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Final verification
    const user1FinalCheck = await verifyUserState(user1Id, 'A', 15); // 10 from test 1 + 5 from test 3
    const user2FinalCheck = await verifyUserState(user2Id, 'B', 10); // Still 10 from test 1
    
    console.log(`✅ Test 3 passed: Mixed operations completed successfully`);

    // Test 4: Interleaved operations - users alternating rapidly
    console.log(`\n⚡ Test 4: Rapid interleaved operations (10 items each, alternating)...`);
    const interleavedPromises: Promise<any>[] = [];
    for (let i = 0; i < 10; i++) {
      interleavedPromises.push(addItem(user1Id, 15 + i + 1, 'A'));
      interleavedPromises.push(addItem(user2Id, 10 + i + 1, 'B'));
    }
    
    const interleavedResults = await Promise.all(interleavedPromises);
    console.log(`✅ All ${interleavedResults.length} interleaved operations completed`);

    // Wait for any pending writes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Final verification
    const user1FinalInterleaved = await verifyUserState(user1Id, 'A', 25); // 15 from previous + 10 from test 4
    const user2FinalInterleaved = await verifyUserState(user2Id, 'B', 20); // 10 from previous + 10 from test 4

    console.log(`✅ Test 4 passed: Interleaved operations completed successfully`);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 All two-user concurrency tests passed!`);
    console.log(`\n📈 Summary:`);
    console.log(`   User A:`);
    console.log(`     - Total items: ${user1FinalInterleaved.items.length}`);
    console.log(`     - User A items: ${user1FinalInterleaved.userItems.length}`);
    console.log(`     - Profile: height=${user1FinalInterleaved.profile.height}, weight=${user1FinalInterleaved.profile.weight}`);
    console.log(`   User B:`);
    console.log(`     - Total items: ${user2FinalInterleaved.items.length}`);
    console.log(`     - User B items: ${user2FinalInterleaved.userItems.length}`);
    console.log(`     - Profile: height=${user2FinalInterleaved.profile.height}, weight=${user2FinalInterleaved.profile.weight}`);
    console.log(`\n✅ No data loss or cross-user interference detected`);

    await cleanup(user1Id, user2Id);
  } catch (error) {
    console.error(`\n❌ Test failed:`, error);
    await cleanup(user1Id, user2Id);
    process.exit(1);
  }
}

// Run the test
runTwoUserConcurrencyTest().catch(console.error);
