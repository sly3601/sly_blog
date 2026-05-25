# sly_blog

这是一个基于 Hexo 和 Butterfly 主题的个人博客。

## 本地开发

```bash
npm install
npm run server
```

默认本地预览地址是 `http://localhost:4000/sly_blog/`。如果 4000 端口被占用，可以运行 `npm run server -- --port 4001`，然后访问 `http://localhost:4001/sly_blog/`。

## 常用命令

```bash
npm run new "文章标题"
npm run clean
npm run build
```

## 部署

推送到 GitHub 后，`.github/workflows/pages.yml` 会构建 Hexo 静态站点并部署到 GitHub Pages。

仓库 Pages 需要使用 GitHub Actions 作为发布源。部署完成后，默认访问地址为：

`https://sly3601.github.io/sly_blog/`
