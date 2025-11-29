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
