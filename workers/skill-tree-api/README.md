# Skill Tree Cloud API

Cloudflare Worker + KV API for the blog skill tree.

## API

- `GET /skill-tree`: read the current public skill tree JSON.
- `PUT /skill-tree`: write the skill tree JSON. Requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `GET /blog-posts?action=list`: list Markdown posts in GitHub. Requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `GET /blog-posts?action=read&path=source/_posts/name.md`: read one post from GitHub.
- `POST /blog-posts`: create or update one post in GitHub.
- `DELETE /blog-posts?path=source/_posts/name.md`: delete one post from GitHub.
- `POST /blog-images`: upload one image to Tencent Cloud COS and return its public URL. Requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `GET /health`: health check.

## Image Upload

The `/write` page can paste screenshots, drag images, or select image files. Configure these Cloudflare secrets/vars before using it:

- `TENCENT_COS_SECRET_ID`: Tencent Cloud API SecretId.
- `TENCENT_COS_SECRET_KEY`: Tencent Cloud API SecretKey.
- `TENCENT_COS_BUCKET`: COS bucket name with APPID, for example `sly-blog-1250000000`.
- `TENCENT_COS_REGION`: COS region, for example `ap-guangzhou`.
- `TENCENT_COS_PUBLIC_BASE_URL`: CDN or custom domain, for example `https://img.example.com`.
- `TENCENT_COS_UPLOAD_PREFIX`: optional object prefix, default `blog`.

Keep `SECRET_ID` and `SECRET_KEY` as Cloudflare secrets, not committed files.

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
