#!/bin/bash

# Test script for PostgreSQL database API
# Tests endpoints to verify PostgreSQL connection is working

BASE_URL="http://localhost:3001"
TIMEOUT=10

echo "🧪 Testing PostgreSQL Database Connection"
echo "=========================================="
echo ""

# Check if backend is running
echo "1️⃣ Checking if backend is running..."
if ! curl -s --connect-timeout 2 "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo "❌ Backend is not running! Please start it with: npm run dev"
  exit 1
fi
echo "✅ Backend is running"
echo ""

# 2. Health check
echo "2️⃣ Testing health endpoint..."
HEALTH=$(curl -s "$BASE_URL/api/health")
echo "Response: $HEALTH"
if [[ "$HEALTH" == *"ok"* ]]; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  exit 1
fi
echo ""

# 3. Get all users
echo "3️⃣ Getting all users..."
USERS_JSON=$(curl -s "$BASE_URL/api/users")
echo "Users: $USERS_JSON"
if [[ "$USERS_JSON" == *"id"* ]]; then
  echo "✅ Users endpoint working"
else
  echo "❌ Users endpoint failed"
  exit 1
fi
echo ""

# Extract first user ID
USER_ID=$(echo "$USERS_JSON" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$USER_ID" ]; then
  echo "⚠️  No user ID found, creating a test user..."
  CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/users" \
    -H "Content-Type: application/json" \
    -d '{"name":"TestUser"}')
  echo "Create user response: $CREATE_USER_RESPONSE"
  USER_ID=$(echo "$CREATE_USER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$USER_ID" ]; then
  echo "❌ Could not get or create user ID"
  exit 1
fi

echo "Using user ID: $USER_ID"
echo ""

# 4. Get items for user
echo "4️⃣ Testing GET /api/items..."
ITEMS_RESPONSE=$(curl -s -H "x-user-id: $USER_ID" "$BASE_URL/api/items")
ITEMS_COUNT=$(echo "$ITEMS_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
echo "Response: $(echo "$ITEMS_RESPONSE" | head -c 200)..."
echo "Found $ITEMS_COUNT items"
if [[ "$ITEMS_RESPONSE" == *"["* ]]; then
  echo "✅ Items endpoint working"
else
  echo "❌ Items endpoint failed"
  exit 1
fi
echo ""

# 5. Get items by category
echo "5️⃣ Testing GET /api/items/by-category..."
CATEGORY_RESPONSE=$(curl -s -H "x-user-id: $USER_ID" "$BASE_URL/api/items/by-category")
echo "Response: $(echo "$CATEGORY_RESPONSE" | head -c 200)..."
if [[ "$CATEGORY_RESPONSE" == *"{"* ]]; then
  echo "✅ Items by category endpoint working"
else
  echo "❌ Items by category endpoint failed"
  exit 1
fi
echo ""

# 6. Get saved outfits
echo "6️⃣ Testing GET /api/outfits/saved..."
OUTFITS_RESPONSE=$(curl -s -H "x-user-id: $USER_ID" "$BASE_URL/api/outfits/saved")
OUTFITS_COUNT=$(echo "$OUTFITS_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
echo "Response: $(echo "$OUTFITS_RESPONSE" | head -c 200)..."
echo "Found $OUTFITS_COUNT saved outfits"
if [[ "$OUTFITS_RESPONSE" == *"["* ]]; then
  echo "✅ Saved outfits endpoint working"
else
  echo "❌ Saved outfits endpoint failed"
  exit 1
fi
echo ""

# 7. Get outfit feedback
echo "7️⃣ Testing GET /api/outfits/feedback..."
FEEDBACK_RESPONSE=$(curl -s -H "x-user-id: $USER_ID" "$BASE_URL/api/outfits/feedback")
FEEDBACK_COUNT=$(echo "$FEEDBACK_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
echo "Response: $(echo "$FEEDBACK_RESPONSE" | head -c 200)..."
echo "Found $FEEDBACK_COUNT feedback entries"
if [[ "$FEEDBACK_RESPONSE" == *"["* ]]; then
  echo "✅ Feedback endpoint working"
else
  echo "❌ Feedback endpoint failed"
  exit 1
fi
echo ""

# 8. Get user profile
echo "8️⃣ Testing GET /api/user/profile..."
PROFILE_RESPONSE=$(curl -s -H "x-user-id: $USER_ID" "$BASE_URL/api/user/profile")
echo "Response: $PROFILE_RESPONSE"
if [[ "$PROFILE_RESPONSE" == *"{"* ]]; then
  echo "✅ Profile endpoint working"
else
  echo "❌ Profile endpoint failed"
  exit 1
fi
echo ""

# 9. Get outfit status
echo "9️⃣ Testing GET /api/outfits/status..."
STATUS_RESPONSE=$(curl -s -H "x-user-id: $USER_ID" "$BASE_URL/api/outfits/status")
echo "Response: $STATUS_RESPONSE"
if [[ "$STATUS_RESPONSE" == *"clicksUsed"* ]]; then
  echo "✅ Outfit status endpoint working"
else
  echo "❌ Outfit status endpoint failed"
  exit 1
fi
echo ""

# 10. Get explore suggestions
echo "🔟 Testing GET /api/explore/suggestions..."
EXPLORE_RESPONSE=$(curl -s -H "x-user-id: $USER_ID" "$BASE_URL/api/explore/suggestions")
echo "Response: $(echo "$EXPLORE_RESPONSE" | head -c 200)..."
if [[ "$EXPLORE_RESPONSE" == *"suggestions"* ]]; then
  echo "✅ Explore suggestions endpoint working"
else
  echo "❌ Explore suggestions endpoint failed"
  exit 1
fi
echo ""

# Summary
echo "=========================================="
echo "✅ All PostgreSQL connection tests passed!"
echo ""
echo "Summary:"
echo "  - Users: Found"
echo "  - Items: $ITEMS_COUNT"
echo "  - Saved Outfits: $OUTFITS_COUNT"
echo "  - Feedback: $FEEDBACK_COUNT"
echo ""
echo "🎉 PostgreSQL migration is working correctly!"

