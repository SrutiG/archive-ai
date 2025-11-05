#!/bin/bash

# Debug script to check frontend-backend connection
# Run this while the frontend is running

echo "🔍 Debugging Frontend-Backend Connection"
echo "======================================"
echo ""

# Check if backend is running
echo "1️⃣ Checking backend..."
if curl -s --connect-timeout 2 http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "✅ Backend is running"
else
  echo "❌ Backend is NOT running!"
  echo "   Start it with: cd backend && npm run dev"
  exit 1
fi
echo ""

# Get all users
echo "2️⃣ Getting all users from backend..."
USERS=$(curl -s http://localhost:3001/api/users)
echo "$USERS" | python3 -m json.tool 2>/dev/null || echo "$USERS"
echo ""

# Extract first user ID
USER_ID=$(echo "$USERS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$USER_ID" ]; then
  echo "❌ No users found in database!"
  exit 1
fi

echo "3️⃣ Using user ID: $USER_ID"
echo ""

# Test with this user ID
echo "4️⃣ Testing GET /api/items with this user ID..."
ITEMS_RESPONSE=$(curl -s -H "x-user-id: $USER_ID" http://localhost:3001/api/items)
ITEMS_COUNT=$(echo "$ITEMS_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
echo "Response: Found $ITEMS_COUNT items"
if [ "$ITEMS_COUNT" -gt 0 ]; then
  echo "✅ Items endpoint working with user ID: $USER_ID"
  echo ""
  echo "First item:"
  echo "$ITEMS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -20 || echo "$ITEMS_RESPONSE" | head -c 500
else
  echo "⚠️  No items found"
fi
echo ""

# Check what user ID the frontend should be using
echo "5️⃣ To check frontend user ID:"
echo "   Open browser console and check:"
echo "   - localStorage.getItem('archive_current_user')"
echo "   - Or check the Network tab for X-User-Id header in API requests"
echo ""

echo "6️⃣ If frontend user ID doesn't match:"
echo "   - Clear browser localStorage/cookies"
echo "   - Login again on the frontend"
echo "   - Make sure you select the user: $(echo "$USERS" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)"
echo ""

echo "✅ Debug complete!"

