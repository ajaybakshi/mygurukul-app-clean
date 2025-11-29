# Real-Time File Search Store Checking - cURL Commands

## Quick Commands

### 1. List All Stores (to get store IDs)
```bash
curl -s "http://localhost:3000/api/file-search/stores/list" | jq '.'
```

Or pretty-printed:
```bash
curl -s "http://localhost:3000/api/file-search/stores/list" | jq '.categorized'
```

### 2. Check Documents in a Specific Store (REAL-TIME)
Replace `YOUR_STORE_ID` with your actual store ID from step 1:

```bash
# Example for Upanishads store
curl -s "http://localhost:3000/api/file-search/stores/documents?storeName=fileSearchStores/YOUR_STORE_ID" | jq '.'
```

**Pretty output:**
```bash
curl -s "http://localhost:3000/api/file-search/stores/documents?storeName=fileSearchStores/YOUR_STORE_ID" | jq '{
  storeName: .storeName,
  documentCount: .documentCount,
  documents: .documents | map({
    displayName: .displayName,
    state: .state,
    sizeKB: .sizeKB,
    createTime: .createTime
  })
}'
```

### 3. Full Diagnostic (All Stores)
```bash
curl -s "http://localhost:3000/api/file-search/stores/diagnose" | jq '.summary'
```

**Detailed output:**
```bash
curl -s "http://localhost:3000/api/file-search/stores/diagnose" | jq '.stores[] | {
  displayName: .displayName,
  status: .status,
  documentCount: .documentCount,
  pendingOperations: .pendingOperations,
  message: .message
}'
```

## Direct Google API Commands (Bypass Next.js)

### 4. Direct Google API - List Documents in Store
Replace `YOUR_STORE_ID` and `YOUR_API_KEY`:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/YOUR_STORE_ID/documents?key=YOUR_API_KEY" | jq '.'
```

**Pretty output:**
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/YOUR_STORE_ID/documents?key=YOUR_API_KEY" | jq '{
  documentCount: (.documents | length),
  documents: .documents | map({
    displayName: .displayName,
    state: .state,
    createTime: .createTime,
    sizeBytes: .sizeBytes
  })
}'
```

## One-Liner to Find Upanishads Store and Check Documents

```bash
# Find Upanishads store ID and check documents in one command
STORE_ID=$(curl -s "http://localhost:3000/api/file-search/stores/list" | jq -r '.categorized.upanishads.name // empty')
if [ -n "$STORE_ID" ]; then
  echo "📚 Checking Upanishads store: $STORE_ID"
  curl -s "http://localhost:3000/api/file-search/stores/documents?storeName=$STORE_ID" | jq '{
    documentCount: .documentCount,
    documents: .documents | map(.displayName)
  }'
else
  echo "❌ Upanishads store not found"
fi
```

## Continuous Monitoring (Refresh Every 10 seconds)

```bash
# Monitor a specific store
STORE_ID="fileSearchStores/YOUR_STORE_ID"
while true; do
  clear
  echo "🔄 $(date '+%Y-%m-%d %H:%M:%S') - Checking store: $STORE_ID"
  curl -s "http://localhost:3000/api/file-search/stores/documents?storeName=$STORE_ID" | jq '{
    timestamp: .timestamp,
    documentCount: .documentCount,
    documents: .documents | map({
      name: .displayName,
      state: .state,
      size: .sizeKB + " KB"
    })
  }'
  sleep 10
done
```

## Quick Check Script

Save this as `check-store.sh`:

```bash
#!/bin/bash

# Get store name from argument or default to Upanishads
STORE_TYPE=${1:-upanishads}

echo "🔍 Finding $STORE_TYPE store..."
STORE_ID=$(curl -s "http://localhost:3000/api/file-search/stores/list" | jq -r ".categorized.$STORE_TYPE.name // empty")

if [ -z "$STORE_ID" ]; then
  echo "❌ $STORE_TYPE store not found"
  exit 1
fi

echo "✅ Found store: $STORE_ID"
echo ""
echo "📄 Documents in store:"
curl -s "http://localhost:3000/api/file-search/stores/documents?storeName=$STORE_ID" | jq -r '
  "Document Count: \(.documentCount)",
  "",
  (.documents[] | "  • \(.displayName) [\(.state)] - \(.sizeKB) KB")
'
```

Usage:
```bash
chmod +x check-store.sh
./check-store.sh upanishads
./check-store.sh vedas
./check-store.sh darshanas
```



