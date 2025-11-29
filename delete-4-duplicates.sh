#!/bin/bash

# Delete 4 Empty Duplicate Stores
# This script deletes the 4 empty duplicate stores (vedas, upanishads, darshanas, epics)
# while keeping the old stores with documents and the new yoga/sastras stores

echo "🗑️  Deleting 4 empty duplicate stores..."
echo ""

# Array of duplicate store IDs to delete
DUPLICATES=(
  "fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz"
  "fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5"
  "fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy"
  "fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q"
)

# Store names for display
STORE_NAMES=(
  "Vedas (duplicate)"
  "Upanishads (duplicate)"
  "Darshanas (duplicate)"
  "Epics (duplicate)"
)

SUCCESS_COUNT=0
FAILED_COUNT=0

for i in "${!DUPLICATES[@]}"; do
  STORE_ID="${DUPLICATES[$i]}"
  STORE_NAME="${STORE_NAMES[$i]}"
  
  echo "Deleting: $STORE_NAME"
  echo "  Store ID: $STORE_ID"
  
  RESPONSE=$(curl -s -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
    -H "Content-Type: application/json" \
    -d "{\"storeName\": \"$STORE_ID\"}")
  
  # Parse response
  SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('true' if d.get('success') else 'false')" 2>/dev/null)
  
  if [ "$SUCCESS" = "true" ]; then
    echo "  ✅ Successfully deleted"
    ((SUCCESS_COUNT++))
  else
    ERROR=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('error', 'Unknown error'))" 2>/dev/null)
    echo "  ❌ Failed: $ERROR"
    ((FAILED_COUNT++))
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo "  ✅ Deleted: $SUCCESS_COUNT"
echo "  ❌ Failed: $FAILED_COUNT"
echo ""

if [ $SUCCESS_COUNT -eq 4 ]; then
  echo "🎉 All duplicates deleted successfully!"
  echo ""
  echo "Verifying stores..."
  curl -s "http://localhost:3000/api/file-search/stores/list" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"Total stores remaining: {d.get('total', 0)}\")
print('')
print('Remaining stores:')
for store in d.get('stores', []):
    print(f\"  • {store['displayName']}\")
"
else
  echo "⚠️  Some deletions failed. Check the errors above."
fi



