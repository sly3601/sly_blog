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

The private `/nav/` page uses the same admin token:

```text
GET /nav-sites
PUT /nav-sites
DELETE /nav-sites
Authorization: Bearer <ADMIN_TOKEN>
```

Image uploads from `/write` use a separate GitHub repository by default. Still images are compressed in the browser before upload:

- Secret: `GITHUB_TOKEN` with repo write permission
- Vars in `wrangler.toml`: `GITHUB_IMAGE_OWNER`, `GITHUB_IMAGE_REPO`, `GITHUB_IMAGE_BRANCH`, `GITHUB_IMAGE_PREFIX`
- Default image repo: `sly3601/sly_blog_images`

The API creates the public image repo on first upload when the token has permission. It inserts URLs like:

```text
https://raw.githubusercontent.com/sly3601/sly_blog_images/main/blog/2026/05/example.webp
```

Optional S.EE fallback:

- Secret: `S_EE_API_KEY`
- Optional var: `S_EE_UPLOAD_PREFIX`, default `blog`

Optional free no-domain Cloudflare R2 path is still supported by binding `BLOG_IMAGES_BUCKET`, but R2 requires Cloudflare billing setup.

Optional Tencent Cloud COS path:

- Secrets: `TENCENT_COS_SECRET_ID`, `TENCENT_COS_SECRET_KEY`
- Vars: `TENCENT_COS_BUCKET`, `TENCENT_COS_REGION`, `TENCENT_COS_PUBLIC_BASE_URL`
- Optional var: `TENCENT_COS_UPLOAD_PREFIX`, default `blog`

Deploy:

```powershell
cd D:\blog\sly_blog\workers\skill-tree-pages
npx wrangler pages deploy dist --project-name sly-skill-tree-api-pages --branch main --commit-dirty true
```
