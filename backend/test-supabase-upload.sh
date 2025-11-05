#!/bin/bash

# Test script for Supabase image upload
# Make sure backend is running on port 3001 before running this

BASE_URL="http://localhost:3001"
USER_ID="user-1762312131982-tm2mtyfeq"
TEST_IMAGE="uploads/056f059e-8c73-485b-a8d6-83e4d6c13e30-everlane-canvas-pants.png"

echo "🧪 Testing Supabase Image Upload"
echo "================================"
echo ""
echo "User ID: $USER_ID"
echo "Test Image: $TEST_IMAGE"
echo ""

# Check if backend is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo "❌ Backend is not running on port 3001!"
  echo "Please start the backend first:"
  echo "  cd backend && npm run dev"
  exit 1
fi

echo "✅ Backend is running"
echo ""

# Check if test image exists
if [ ! -f "$TEST_IMAGE" ]; then
  echo "❌ Test image not found: $TEST_IMAGE"
  exit 1
fi

echo "📤 Uploading test item with image..."
echo ""

# Upload item with image
RESPONSE=$(curl -s -X POST "$BASE_URL/api/items" \
  -H "x-user-id: $USER_ID" \
  -F "title=Test Item - Supabase Upload $(date +%H:%M:%S)" \
  -F "category=Tops" \
  -F "description=Testing Supabase image upload via API" \
  -F "photo=@$TEST_IMAGE")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract imageUrl from response
IMAGE_URL=$(echo "$RESPONSE" | grep -o '"imageUrl":"[^"]*"' | sed 's/"imageUrl":"\([^"]*\)"/\1/')

if [ -n "$IMAGE_URL" ]; then
  echo "✅ Image uploaded successfully!"
  echo "Image URL: $IMAGE_URL"
  echo ""
  
  # Check if it's a Supabase URL
  if echo "$IMAGE_URL" | grep -q "supabase.co"; then
    echo "✅ Image is stored in Supabase Storage!"
    echo ""
    echo "You can verify by opening this URL in your browser:"
    echo "$IMAGE_URL"
  else
    echo "⚠️  Image URL is not from Supabase (might be using local storage fallback)"
    echo "Check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables"
  fi
else
  echo "❌ Failed to extract imageUrl from response"
  echo "Check the response above for errors"
fi

