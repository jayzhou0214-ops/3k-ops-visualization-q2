# 3K运营看板 OSS/COS 稳定版部署说明

## 现在应该上传哪个文件夹

上传这个目录里的全部文件，并保持目录结构不变：

```text
/Users/zhoujianeng/Desktop/3k 投流/codex3k文件/web/3k-ops-visualization-q2/dist/oss-stable
```

这个目录是稳定发布包，特点是：

- React、D3、Three、GSAP、XLSX、图标库已经放到本地 `vendor/` 目录。
- 页面运行时不再依赖 `esm.sh`、GitHub Pages 或其他海外前端 CDN。
- 手机和电脑都按静态网站方式访问，不需要服务器程序。

## 为什么 GitHub Pages 会首页能看、后面白屏

GitHub Pages 本身在部分国内网络、公司网络、微信/企微内置浏览器里不够稳定。原页面还会加载外部前端依赖，首页可能先出来，但后续模块渲染、图表、下钻交互需要的脚本如果被拦截或超时，就会白屏。

稳定版的核心处理方式是：把外部依赖全部本地化，然后放到国内 OSS/COS/CDN。

## 推荐方案

优先选公司已有账号和域名备案的一家：

- 公司偏腾讯生态、企微分享多：腾讯云 COS + CDN。
- 公司已有阿里云账号、域名或备案：阿里云 OSS + CDN。
- 真正影响稳定性的不是品牌，而是：国内对象存储 + CDN + HTTPS + 本地化依赖。

## 腾讯云 COS 部署步骤

1. 新建 COS 存储桶，地域选主要访问人群附近，例如华北、华东或华南。
2. 上传 `dist/oss-stable` 目录内的所有文件，不要只上传 `index.html`。
3. 开启静态网站功能。
4. 首页文档设置为 `index.html`。
5. 错误文档也设置为 `index.html`，避免 SPA 跳转刷新后 404。
6. 如果用于正式汇报或长期分享，绑定公司域名并接入 CDN，再开启 HTTPS。
7. 检查 MIME 类型：
   - `.mjs`：`text/javascript` 或 `application/javascript`
   - `.js`：`application/javascript`
   - `.css`：`text/css`
   - `.html`：`text/html`
   - `.xlsx`：`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

腾讯云官方文档：

- 静态网站：https://cloud.tencent.com/document/product/436/14984
- 单页应用实践：https://cloud.tencent.com/document/practice/436/64575

## 阿里云 OSS 部署步骤

1. 新建 OSS Bucket，地域选主要访问人群附近。
2. 上传 `dist/oss-stable` 目录内的所有文件，并保留 `src/`、`data/`、`vendor/` 子目录。
3. 开启静态网站托管。
4. 默认首页设置为 `index.html`。
5. 默认 404 页或错误页设置为 `index.html`，用于兼容页面跳转和刷新。
6. 正式使用时绑定自定义域名，接入 CDN，并启用 HTTPS。
7. 检查 `.mjs`、`.js`、`.css`、`.xlsx` 的 MIME 类型是否正确。

阿里云官方文档：

- 静态网站托管：https://help.aliyun.com/zh/oss/user-guide/hosting-static-websites

## 上传后怎么验收

打开 OSS/COS 生成的网址后，按这个顺序检查：

1. 电脑浏览器打开首页。
2. 手机浏览器或企微/微信打开首页。
3. 点击“查看全国数据”“规则地图”“奖励机制”等模块。
4. 进入数据更新区，下载 Excel 模板。
5. 上传一份模板数据，确认柱状图、折线图、热力图、地图、品牌矩阵都即时更新。
6. 刷新页面，确认不会 404 或白屏。

## 后期怎么更新

以后优化页面时，先改当前项目里的源码。`/Users/zhoujianeng/Desktop/3K运营可视化网页_长期维护` 只是保留的旧路径跳转：

- `src/app.js`
- `styles.css`
- `data/competition-data.js`
- `data/3k-q2-data-template.xlsx`

改完后重新生成 `dist/oss-stable` 稳定包，再把新的 `dist/oss-stable` 全量覆盖上传到 COS/OSS。为了避免访问者看到缓存旧页面，发布链接可以加版本号，例如：

```text
https://你的域名/?v=20260520
```
