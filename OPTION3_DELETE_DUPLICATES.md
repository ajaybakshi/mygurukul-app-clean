# Option 3: Individual Deletion - Implementation Guide

## Quick Start

### Method A: Use the Script (Easiest)

```bash
./delete-4-duplicates.sh
```

This script will:
1. Delete all 4 empty duplicate stores
2. Show success/failure for each
3. Verify the final store count
4. Display remaining stores

### Method B: Run Commands Manually

Copy and paste this into your terminal:

```bash
# Delete Vedas duplicate
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz"}'

# Delete Upanishads duplicate
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5"}'

# Delete Darshanas duplicate
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy"}'

# Delete Epics duplicate
curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
  -H "Content-Type: application/json" \
  -d '{"storeName": "fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q"}'
```

### Method C: One-Liner (All at Once)

```bash
for store in \
  "fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz" \
  "fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5" \
  "fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy" \
  "fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q"; do
  echo "Deleting $store..."
  curl -X DELETE "http://localhost:3000/api/file-search/stores/delete" \
    -H "Content-Type: application/json" \
    -d "{\"storeName\": \"$store\"}"
  echo ""
done
```

## What Gets Deleted

These 4 empty duplicate stores:
1. ✅ `fileSearchStores/vedas-mygurukul-sacred-libr-47y2v1sywrfz` (0 docs)
2. ✅ `fileSearchStores/upanishads-mygurukul-sacred-o4nm6bjo20k5` (0 docs)
3. ✅ `fileSearchStores/darshanas-philosophical-sys-d16aa6q56riy` (0 docs)
4. ✅ `fileSearchStores/epics-mygurukul-sacred-libr-e9lzszyz0k5q` (0 docs)

## What Stays (Protected)

These stores are protected and won't be deleted:
- ✅ Vedas (old): `fileSearchStores/vedas-mygurukul-sacred-libr-3mjn81k3k4n5` (6 docs)
- ✅ Upanishads (old): `fileSearchStores/upanishads-mygurukul-sacred-c8mafm3ykkw9` (10 docs)
- ✅ Darshanas (old): `fileSearchStores/darshanas-mygurukul-sacred--eunb1m3n9ijl` (9 docs)
- ✅ Epics (old): `fileSearchStores/epics-mygurukul-sacred-libr-wgzuh46tehax` (6 docs)
- ✅ Yoga (new): `fileSearchStores/yoga-mygurukul-sacred-libra-mg4b2gtka68h`
- ✅ Sastras (new): `fileSearchStores/sastras-mygurukul-sacred-li-sitzp4ae5niy`

## Verification

After running, verify you have 6 stores:

```bash
curl -s "http://localhost:3000/api/file-search/stores/list" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"Total stores: {d.get('total', 0)}\")
print('')
for store in d.get('stores', []):
    print(f\"  • {store['displayName']}\")
"
```

Expected: 6 stores total

## Troubleshooting

### If you get 403 PERMISSION_DENIED:
The delete endpoint now tries both SDK and REST API. If it still fails:
1. Check the store ID is correct
2. Verify the store is empty (0 documents)
3. Check terminal logs for detailed error messages

### If a store fails to delete:
The script will continue with the others. You can retry the failed one individually.

## Safety

- ✅ Safety check: Each store is verified to have 0 documents before deletion
- ✅ Protection: Stores with documents cannot be deleted (unless force=true)
- ✅ Logging: All operations are logged in the terminal



