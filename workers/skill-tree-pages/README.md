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

Image uploads from `/write` need Tencent Cloud COS config:

- Secrets: `TENCENT_COS_SECRET_ID`, `TENCENT_COS_SECRET_KEY`
- Vars: `TENCENT_COS_BUCKET`, `TENCENT_COS_REGION`, `TENCENT_COS_PUBLIC_BASE_URL`
- Optional var: `TENCENT_COS_UPLOAD_PREFIX`, default `blog`

Deploy:

```powershell
cd D:\blog\sly_blog\workers\skill-tree-pages
npx wrangler pages deploy dist --project-name sly-skill-tree-api-pages --branch main --commit-dirty true
```
