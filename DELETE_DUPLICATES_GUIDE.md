# Safe Deletion Guide for Duplicate Stores

## Current Situation

You have duplicate stores. Here's what needs to happen:

### KEEP (Old stores with documents):
- **Vedas**: `fileSearchStores/vedas-mygurukul-sacred-libr-3mjn81k3k4n5` (6 docs)
- **Upanishads**: `fileSearchStores/upanishads-mygurukul-sacred-c8mafm3ykkw9` (10 docs)
- **Darshanas**: `fileSearchStores/darshanas-mygurukul-sacred--eunb1m3n9ijl` (9 docs)
- **Epics**: `fileSearchStores/epics-mygurukul-sacred-libr-wgzuh46tehax` (6 docs)

### DELETE (New empty duplicates):
- **Vedas**: `fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz` (0 docs)
- **Upanishads**: `fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5` (0 docs)
- **Darshanas**: `fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy` (0 docs)
- **Epics**: `fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q` (0 docs)

### KEEP (New stores):
- **Yoga**: `fileSearchStores/yoga-mygurukul-sacred-libra-mg4b2gtka68h`
- **Sastras**: `fileSearchStores/sastras-mygurukul-sacred-li-sitzp4ae5niy`

## Method 1: Automated Script (Recommended)

Run the safe deletion script:

```bash
./delete-duplicate-stores.sh
```

This script will:
1. Analyze all stores and identify empty duplicates
2. Show you what will be deleted
3. Ask for confirmation
4. Delete only empty duplicate stores
5. Report results

## Method 2: Manual Analysis First

### Step 1: Analyze duplicates (dry run)
```bash
curl -s "http://localhost:3000/api/file-search/stores/cleanup-duplicates" | python3 -m json.tool
```

This shows you:
- All duplicate stores
- Document count for each
- Which ones are empty and safe to delete

### Step 2: Delete empty duplicates
```bash
curl -X POST "http://localhost:3000/api/file-search/stores/cleanup-duplicates" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}' | python3 -m json.tool
```

## Method 3: Individual Store Deletion

If you prefer to delete stores one by one:

### Delete Vedas duplicate:
```bash
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz"}'
```

### Delete Upanishads duplicate:
```bash
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5"}'
```

### Delete Darshanas duplicate:
```bash
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy"}'
```

### Delete Epics duplicate:
```bash
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q"}'
```

## Safety Features

The delete endpoint now includes:
- ✅ **Safety check**: Verifies store is empty before deletion
- ✅ **Error handling**: Tries SDK first, falls back to REST API
- ✅ **Detailed logging**: Shows what's happening at each step
- ✅ **Prevention**: Won't delete stores with documents (unless force=true)

## Verification

After deletion, verify stores:

```bash
curl -s "http://localhost:3000/api/file-search/stores/list" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Total stores: {data.get('total', 0)}\")
print('')
for store in data.get('stores', []):
    print(f\"  • {store['displayName']}\")
"
```

You should see 6 stores:
- Vedas (old, with docs)
- Upanishads (old, with docs)
- Darshanas (old, with docs)
- Epics (old, with docs)
- Yoga (new)
- Sastras (new)

## Troubleshooting

### If you get 403 PERMISSION_DENIED:
The delete endpoint now tries both SDK and REST API methods. If both fail:
1. Check your API key has proper permissions
2. Verify the store name is correct
3. Try using the REST API directly (see Method 4)

### Method 4: Direct REST API (if endpoint fails)

```bash
# Replace YOUR_API_KEY and STORE_ID
curl -X DELETE "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/STORE_ID?key=YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

## Important Notes

- ⚠️ **Never delete stores with documents** - The safety check prevents this
- ✅ **Empty stores are safe to delete** - They have 0 documents
- 🔒 **Old stores are protected** - They have documents and won't be deleted
- 📝 **All operations are logged** - Check terminal for details



