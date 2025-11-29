#!/bin/bash

echo "🔍 Checking Darshanas Store..."
echo ""

# Get darshana store ID
STORE_ID=$(curl -s "http://localhost:3000/api/file-search/stores/list" | python3 -c "import sys, json; data = json.load(sys.stdin); store = data.get('categorized', {}).get('darshanas', {}); print(store.get('name', ''))")

if [ -z "$STORE_ID" ]; then
  echo "❌ Darshanas store not found!"
  exit 1
fi

echo "✅ Store ID: $STORE_ID"
echo ""

# Check documents
echo "📄 Documents in store:"
curl -s "http://localhost:3000/api/file-search/stores/documents?storeName=$STORE_ID" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Document Count: {data.get('documentCount', 0)}\")
print('')
for doc in data.get('documents', []):
    print(f\"  • {doc.get('displayName', 'Unknown')} [{doc.get('state', 'UNKNOWN')}] - {doc.get('sizeKB', '0')} KB\")
"
