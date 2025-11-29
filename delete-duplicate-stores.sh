#!/bin/bash

# Safe Deletion Script for Duplicate File Search Stores
# This script identifies and deletes only empty duplicate stores

echo "🔍 Analyzing duplicate stores..."
echo ""

# Step 1: Analyze duplicates (dry run)
echo "Step 1: Analyzing stores (dry run)..."
ANALYSIS=$(curl -s "http://localhost:3000/api/file-search/stores/cleanup-duplicates")

echo "$ANALYSIS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Total stores: {data.get('totalStores', 0)}\")
print(f\"Duplicates found: {data.get('duplicatesFound', 0)}\")
print(f\"Empty stores found: {data.get('emptyStoresFound', 0)}\")
print('')
if data.get('emptyStores'):
    print('Empty duplicate stores to delete:')
    for store in data['emptyStores']:
        print(f\"  • {store['displayName']}\")
        print(f\"    ID: {store['name']}\")
        print(f\"    Category: {store['category']}\")
        print('')
else:
    print('✅ No empty duplicate stores found')
    sys.exit(0)
"

if [ $? -ne 0 ]; then
    echo "❌ Analysis failed or no duplicates found"
    exit 1
fi

echo ""
echo "Step 2: Review the analysis above"
echo ""
read -p "Do you want to proceed with deletion? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deletion cancelled"
    exit 0
fi

# Step 2: Delete empty duplicates
echo ""
echo "🗑️  Deleting empty duplicate stores..."
echo ""

RESULT=$(curl -s -X POST "http://localhost:3000/api/file-search/stores/cleanup-duplicates" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}')

echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success'):
    summary = data.get('summary', {})
    print(f\"✅ Cleanup completed!\")
    print(f\"   Deleted: {summary.get('emptyStoresDeleted', 0)} stores\")
    print(f\"   Failed: {summary.get('failedDeletions', 0)} stores\")
    print('')
    print('Deletion results:')
    for result in data.get('deletionResults', []):
        if result.get('success'):
            print(f\"  ✅ {result['displayName']}\")
        else:
            print(f\"  ❌ {result['displayName']}: {result.get('error', 'Unknown error')}\")
else:
    print(f\"❌ Cleanup failed: {data.get('error', 'Unknown error')}\")
    sys.exit(1)
"



