# Skill Tree Pages API

Cloudflare Pages Functions deployment for the skill tree API.

Production endpoint:

```text
https://sly-skill-tree-api-pages.pages.dev
```

This uses the same KV namespace and API shape as `workers/skill-tree-api`.

The blog page reads:

```text
GET /skill-tree
```

Admin saves use:

```text
PUT /skill-tree
Authorization: Bearer <ADMIN_TOKEN>
```

The `/write` page also uses:

```text
GET /blog-posts?action=list
GET /blog-posts?action=read&path=source/_posts/name.md
POST /blog-posts
DELETE /blog-posts?path=source/_posts/name.md
POST /blog-images
Authorization: Bearer <ADMIN_TOKEN>
```

Image uploads from `/write` use S.EE by default:

- Secret: `S_EE_API_KEY`
- Optional var: `S_EE_UPLOAD_PREFIX`, default `blog`

Optional free no-domain Cloudflare R2 path:

```toml
[[r2_buckets]]
binding = "BLOG_IMAGES_BUCKET"
bucket_name = "sly-blog-images"
```

When R2 is bound, `/write` uploads to R2 first and inserts URLs like:

```text
https://sly-skill-tree-api-pages.pages.dev/blog-images/blog/2026/05/example.png
```

No Tencent Cloud keys or custom domain are required for the R2 path.

Optional Tencent Cloud COS path:

- Secrets: `TENCENT_COS_SECRET_ID`, `TENCENT_COS_SECRET_KEY`
- Vars: `TENCENT_COS_BUCKET`, `TENCENT_COS_REGION`, `TENCENT_COS_PUBLIC_BASE_URL`
- Optional var: `TENCENT_COS_UPLOAD_PREFIX`, default `blog`

Deploy:

```powershell
cd D:\blog\sly_blog\workers\skill-tree-pages
npx wrangler pages deploy dist --project-name sly-skill-tree-api-pages --branch main --commit-dirty true
```
