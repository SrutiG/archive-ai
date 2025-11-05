#!/bin/bash

# Test script for SQLite database API
# Tests endpoints for user "Sruti"

BASE_URL="http://localhost:3001"
echo "🧪 Testing SQLite Database API"
echo "================================"
echo ""

# 1. Health check
echo "1️⃣ Testing health endpoint..."
curl -s "$BASE_URL/api/health"
echo ""
echo ""

# 2. Get all users to find Sruti's ID
echo "2️⃣ Getting all users..."
USERS_JSON=$(curl -s "$BASE_URL/api/users")
echo "$USERS_JSON"
echo ""

# Extract Sruti's user ID using grep/sed (works without jq)
SRUTI_ID=$(echo "$USERS_JSON" | grep -o '"name":"Sruti"[^}]*"id":"[^"]*"' | sed 's/.*"id":"\([^"]*\)".*/\1/' | head -1)

if [ -z "$SRUTI_ID" ]; then
  # Try alternative extraction method
  SRUTI_ID=$(echo "$USERS_JSON" | grep -A 5 "Sruti" | grep '"id"' | head -1 | sed 's/.*"id":"\([^"]*\)".*/\1/')
fi

if [ -z "$SRUTI_ID" ]; then
  echo "❌ User 'Sruti' not found in database"
  echo "Available users from JSON:"
  echo "$USERS_JSON"
  exit 1
fi

echo "✅ Found Sruti with ID: $SRUTI_ID"
echo ""

# 3. Get Sruti's user details
echo "3️⃣ Getting Sruti's user details..."
curl -s "$BASE_URL/api/users/$SRUTI_ID"
echo ""
echo ""

# 4. Get Sruti's wardrobe items
echo "4️⃣ Getting Sruti's wardrobe items..."
ITEMS_JSON=$(curl -s -H "x-user-id: $SRUTI_ID" "$BASE_URL/api/items")
echo "$ITEMS_JSON"
ITEM_COUNT=$(echo "$ITEMS_JSON" | grep -o '"id"' | wc -l | tr -d ' ')
echo ""
echo "Found $ITEM_COUNT items"
echo ""

# 5. Get items grouped by category
echo "5️⃣ Getting items grouped by category..."
curl -s -H "x-user-id: $SRUTI_ID" "$BASE_URL/api/items/by-category"
echo ""
echo ""

# 6. Get outfit generation status
echo "6️⃣ Getting outfit generation status..."
curl -s -H "x-user-id: $SRUTI_ID" "$BASE_URL/api/outfits/status"
echo ""
echo ""

# 7. Generate outfits (if we have items)
if [ "$ITEM_COUNT" -gt 0 ]; then
  echo "7️⃣ Generating outfits for Sruti..."
  OUTFITS_JSON=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "x-user-id: $SRUTI_ID" \
    -d '{}' \
    "$BASE_URL/api/outfits/generate")
  
  echo "$OUTFITS_JSON"
  
  # Check if we got an error
  if echo "$OUTFITS_JSON" | grep -q '"error"'; then
    echo "⚠️  Could not generate outfits (see error above)"
  else
    OUTFIT_COUNT=$(echo "$OUTFITS_JSON" | grep -o '"itemTitles"' | wc -l | tr -d ' ')
    echo ""
    echo "✅ Generated $OUTFIT_COUNT outfit combinations"
  fi
  echo ""
  echo ""
fi

# 8. Get saved outfits
echo "8️⃣ Getting saved outfits..."
SAVED_OUTFITS_JSON=$(curl -s -H "x-user-id: $SRUTI_ID" "$BASE_URL/api/outfits/saved")
echo "$SAVED_OUTFITS_JSON"
SAVED_COUNT=$(echo "$SAVED_OUTFITS_JSON" | grep -o '"id"' | wc -l | tr -d ' ')
echo ""
echo "Found $SAVED_COUNT saved outfits"
echo ""
echo ""

# 9. Get user profile
echo "9️⃣ Getting user profile..."
curl -s -H "x-user-id: $SRUTI_ID" "$BASE_URL/api/user/profile"
echo ""
echo ""

# 10. Get explore suggestions
echo "🔟 Getting explore suggestions..."
curl -s -H "x-user-id: $SRUTI_ID" "$BASE_URL/api/explore/suggestions"
echo ""
echo ""

echo "✅ API testing complete!"
echo ""
echo "Summary:"
echo "  - User ID: $SRUTI_ID"
echo "  - Items: $ITEM_COUNT"
echo "  - Saved Outfits: $SAVED_COUNT"
