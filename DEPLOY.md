# GitHub Pages 部署

已部署：

```text
站点：https://zhuyouyi3rd.github.io/chain-risk-control/
仓库：https://github.com/zhuyouyi3rd/chain-risk-control
```

## 当前配置

- `.github/workflows/deploy-pages.yml`
- Vite `base` 由 `VITE_BASE` 控制
- GitHub Actions 使用相对路径 `VITE_BASE=./`
- 已包含 `public/.nojekyll`
- 3D 模型路径使用 `import.meta.env.BASE_URL`，项目页子路径 `/chain-risk-control/` 可正常加载
- 本地开发仍使用根路径 `/`

## 更新部署

```bash
git add .
git commit -m "update: ..."
git push
```

推送到 `main` 后自动执行：

```text
Deploy GitHub Pages
  ├─ npm ci
  ├─ npm run build
  └─ deploy-pages
```

## 首次开启 Pages

如果是新仓库，在 GitHub 仓库中设置：

```text
Settings → Pages → Build and deployment → Source
```

选择：

```text
GitHub Actions
```

## 本地验证 Pages 构建

```bash
# Windows PowerShell
$env:VITE_BASE="./"
npm run build
python -m http.server 4173 --directory dist
```

访问：

```text
http://127.0.0.1:4173/
```

生产构建的资源路径会变成相对路径：

```text
./assets/index-xxxx.js
./models/warehouse.glb
```

## 3D 模型

运行时模型位于 `public/models`，已用 glTF Transform 做 Web 优化：

- 几何简化到约 2 万三角面/模型
- Meshopt 压缩几何数据
- 贴图降为 256×256 WebP
- 单模型约 100–207 KB，六个合计约 0.85 MB
- `ThreeScene` 已接入 `MeshoptDecoder`，可读取 `EXT_meshopt_compression`

原始高精度 GLB 保留在本地的 `产业风控系统3D建模/`，该目录已被 `.gitignore` 排除，不重复进入仓库。

重新优化单个模型：

```bash
npx @gltf-transform/cli optimize public/models/warehouse.glb /tmp/warehouse.glb \
  --compress meshopt \
  --texture-compress webp \
  --texture-size 256 \
  --simplify-ratio 0.02 \
  --simplify-error 0.002 \
  --palette false
```
