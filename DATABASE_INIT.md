# Database Initialization

If you encounter issues with settings not being saved, you may need to initialize the D1 database schema.

## Quick Fix

Run the initialization script:

```bash
./init-db.sh
```

## Manual Initialization

If the script doesn't work, you can manually apply the schema:

```bash
# Apply the schema to your D1 database
npx wrangler d1 execute veil-db --remote --file=./schema.sql

# Verify the tables were created
npx wrangler d1 execute veil-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Check the settings table structure
npx wrangler d1 execute veil-db --remote --command="PRAGMA table_info(settings);"
```

## Troubleshooting

### Settings not saving

1. Check if the `settings` table exists:
   ```bash
   npx wrangler d1 execute veil-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='settings';"
   ```

2. If it doesn't exist, run the initialization script above.

3. Check the browser console for errors when saving settings.

4. Check the Cloudflare Workers logs for API errors:
   ```bash
   npx wrangler tail veil-frontend
   ```

### Authentication issues

Make sure you're logged into Cloudflare:
```bash
npx wrangler login
```

### Database binding issues

Verify the database ID in `workers/frontend/wrangler.toml` matches your actual D1 database:
```toml
[[d1_databases]]
binding = "DB"
database_name = "veil-db"
database_id = "your-database-id-here"
```
