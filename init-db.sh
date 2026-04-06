#!/bin/bash
# Initialize the D1 database with the schema

set -e

echo "🚀 Initializing Veil D1 database..."
echo ""

# Apply the schema
echo "📝 Applying schema to D1 database..."
npx wrangler d1 execute veil-db --remote --file=./schema.sql

echo ""
echo "✅ Verifying tables..."
npx wrangler d1 execute veil-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

echo ""
echo "📊 Checking settings table structure..."
npx wrangler d1 execute veil-db --remote --command="PRAGMA table_info(settings);"

echo ""
echo "✨ Database initialization complete!"
echo ""
echo "You can now save settings from the UI at https://veil.seiffert.me/settings"
