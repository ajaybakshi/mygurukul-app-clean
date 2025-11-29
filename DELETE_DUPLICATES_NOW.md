# Delete Duplicate Stores - Quick Guide

## Current Situation

You have **4 empty duplicate stores** to delete:

1. **Vedas duplicate**: `fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz` (0 docs)
2. **Upanishads duplicate**: `fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5` (0 docs)
3. **Darshanas duplicate**: `fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy` (0 docs)
4. **Epics duplicate**: `fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q` (0 docs)

## Method 1: Automated Cleanup (Recommended)

Run the cleanup script:
```bash
./delete-duplicate-stores.sh
```

Or use the API directly:
```bash
# Step 1: Analyze (dry run)
curl -s "http://localhost:3000/api/file-search/stores/cleanup-duplicates" | python3 -m json.tool

# Step 2: Delete (with confirmation)
curl -X POST "http://localhost:3000/api/file-search/stores/cleanup-duplicates" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}' | python3 -m json.tool
```

## Method 2: Individual Deletion (Manual)

Delete each duplicate store one by one:

### 1. Delete Vedas duplicate:
```bash
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz"}'
```

### 2. Delete Upanishads duplicate:
```bash
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5"}'
```

### 3. Delete Darshanas duplicate:
```bash
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy"}'
```

### 4. Delete Epics duplicate:
```bash
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q"}'
```

## All-in-One Command

Delete all 4 duplicates at once:
```bash
for store in \
  "fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz" \
  "fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5" \
  "fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy" \
  "fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q"; do
  echo "Deleting $store..."
  curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
    -H "Content-Type: application/json" \
    -d "{\"storeName\": \"$store\"}" | python3 -c "import sys, json; d=json.load(sys.stdin); print('  ✅ Success' if d.get('success') else f\"  ❌ Failed: {d.get('error', 'Unknown')}\")"
  echo ""
done
```

## Verification

After deletion, verify you have 6 stores (4 old + 2 new):
```bash
curl -s "http://localhost:3000/api/file-search/stores/list" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"Total stores: {d.get('total', 0)}\")
print('')
print('Stores:')
for store in d.get('stores', []):
    print(f\"  • {store['displayName']}\")
"
```

Expected result: 6 stores
- Vedas (old, with docs)
- Upanishads (old, with docs)
- Darshanas (old, with docs)
- Epics (old, with docs)
- Yoga (new)
- Sastras (new)

## Safety Features

The delete endpoint now includes:
- ✅ **Safety check**: Verifies store is empty (0 documents) before deletion
- ✅ **Dual method**: Tries SDK first, falls back to REST API if needed
- ✅ **Error handling**: Better error messages for 403 and other errors
- ✅ **Protection**: Won't delete stores with documents (unless force=true)

## If You Get 403 Errors

The delete endpoint now tries both SDK and REST API. If you still get 403:
1. The store might have been deleted already
2. Check the store name is correct
3. Try the REST API directly (see DELETE_DUPLICATES_GUIDE.md)



