# sly_blog

这是一个基于 Hexo 和 Butterfly 主题的个人博客，已从旧博客 `D:\blog_yzz` 迁移文章、页面、图片、友链、音乐、Live2D 和样式装饰。

## 本地开发

```bash
npm install
npm run server
```

默认本地预览地址是 `http://localhost:4000/sly_blog/`。如果 4000 端口被占用，可以运行 `npm run server -- --port 4002`，然后访问 `http://localhost:4002/sly_blog/`。

## 常用命令

```bash
npm run new "文章标题"
npm run clean
npm run build
```

## 内容

- 文章放在 `source/_posts/`
- 本地图片放在 `source/img/`
- 自定义 CSS 放在 `source/css/custom.css`
- 自定义脚本放在 `source/js/`
- 友链数据放在 `source/_data/link.yml`

博客当前部署在 GitHub Pages 项目页，所以本地资源在文章里应使用 `/sly_blog/...` 开头，例如：

```html
<img src="/sly_blog/img/photos/example.png" alt="example" />
```

## 图片

少量长期重要图片可以直接放进 `source/img/`，这样随博客一起部署，最稳。大量图片建议使用 Cloudinary、ImgBB 或 SM.MS/S.EE 这类外部图床，再把图片链接写进文章。

## 部署

推送到 GitHub 后，`.github/workflows/pages.yml` 会构建 Hexo 静态站点并部署到 GitHub Pages。

仓库 Pages 需要使用 GitHub Actions 作为发布源。部署完成后，默认访问地址为：

`https://sly3601.github.io/sly_blog/`
