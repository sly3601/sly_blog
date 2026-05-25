# Skill Tree Cloud API

Cloudflare Worker + KV API for the blog skill tree.

## API

- `GET /skill-tree`: read the current public skill tree JSON.
- `PUT /skill-tree`: write the skill tree JSON. Requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `GET /health`: health check.

## Deploy

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Create a KV namespace and put its `id` into `wrangler.toml`.
3. Add the admin token as a Cloudflare secret named `ADMIN_TOKEN`.
4. Deploy the Worker.
5. Paste the Worker URL into the blog skill-tree page's cloud endpoint field, then click cloud save once.

Typical commands:

```powershell
cd D:\blog\sly_blog\workers\skill-tree-api
npx wrangler login
npx wrangler kv namespace create SKILL_TREE_KV
Copy-Item wrangler.toml.example wrangler.toml
# Edit wrangler.toml and replace the KV namespace id.
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

After deployment, set the endpoint to the Worker origin, for example:

```text
https://sly-skill-tree-api.<your-subdomain>.workers.dev
```

If `workers.dev` is unstable on the current network, use the Pages Functions deployment in `workers/skill-tree-pages` instead.

The admin token is never committed to GitHub. It lives in Cloudflare Secret storage and is only typed into your own browser when saving.
