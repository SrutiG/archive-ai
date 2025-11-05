#!/bin/bash

# Backup script for SQLite database
# Creates a timestamped backup of the wardrobe database

DB_DIR="data"
DB_FILE="$DB_DIR/wardrobe.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$DB_DIR/wardrobe.db.backup.$TIMESTAMP"

if [ ! -f "$DB_FILE" ]; then
  echo "❌ Database file not found: $DB_FILE"
  exit 1
fi

# Create backup
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Database backup created successfully!"
  echo "   Backup file: $BACKUP_FILE"
  echo ""
  
  # Show database stats
  echo "📊 Database contents:"
  sqlite3 "$DB_FILE" <<EOF
SELECT 'Users: ' || COUNT(*) FROM users;
SELECT 'Items: ' || COUNT(*) FROM wardrobe_items;
SELECT 'Saved Outfits: ' || COUNT(*) FROM saved_outfits;
SELECT 'Feedback: ' || COUNT(*) FROM outfit_feedback;
SELECT 'Explore Suggestions: ' || COUNT(*) FROM explore_suggestions;
EOF
  
  echo ""
  echo "💾 Backup saved to: $BACKUP_FILE"
  ls -lh "$BACKUP_FILE"
else
  echo "❌ Failed to create backup"
  exit 1
fi

