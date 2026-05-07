# Database Initialization

If you encounter issues with settings not being saved, you may need to initialize the D1 database schema.

## Applying schema

Run once after cloning, and again whenever new migrations are added:

```bash
npx wrangler d1 migrations apply veil-db --remote
```

Wrangler tracks which migrations have run in a `d1_migrations` table and only
applies new ones. Never edit existing migration files — add a new numbered file
instead.

## Troubleshooting

### Settings not saving

1. Check if the `settings` table exists:
   ```bash
   npx wrangler d1 execute veil-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='settings';"
   ```

2. If it doesn't exist, run the migrations above.

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
migrations_dir = "../../migrations"
```
