# 2026 Q2 3K运营劳动竞赛规则可视化

这是一个静态 React + Three.js + D3 + GSAP 网页，用于展示公司 2026 年第二季度 3K 运营劳动竞赛规则、附件指标和培训口径。

当前 GitHub Pages 入口已指向国内稳定版：`https://map.jianengzhou.com/3k/index.html?v=20260605-kos`。

## 本地运行

```bash
python3 -m http.server 4173
```

然后打开：

```text
http://127.0.0.1:4173/
```

## GitHub Pages 发布

仓库推送到 GitHub 后，启用 Pages 或运行内置的 GitHub Actions 工作流即可发布。页面为纯静态文件，不需要构建步骤。

## 数据更新

页面现在只保留 Excel 更新入口。优先直接上传创作中心导出的原始报表，工作簿需包含：

- `发布明细报表`
- `KOS对应关系`

页面会按 `ZD编码` 补回省份、城市、区县，并自动派生两个互相独立的赛道：

- `officeKosRace`：办事处 KOS 赛道，全国排名、TOP1000、完成率与达标率。
- `regionalKosRace`：大区 KOS 赛道，晋冀浓情・万店同荐活动排名、发布状态、平台作品得分。

晋冀大区发布状态归入 `regionalKosRace`，不归入办事处赛道。当前最终办事处赛道数据口径从 `2026-03-26` 开始；大区 KOS 赛道规则从 `2026-06-01` 开始，并以表格内已发布成功时间为准，文件名截止日不作为删减依据。

旧模板仍兼容。下载模板 `data/3k-q2-data-template.xlsx` 后填写两张表：

- `officeMetrics`：`region`、`office`、`target`、`actual`、`totalWorks`、`qualifiedWorks`、`top1000`、`abnormal`、`dataDate`、`sourceNote`
- `brandMetrics`：`brand`、`target`、`actual`、`totalWorks`、`qualifiedWorks`、`top1000`、`abnormal`、`dataDate`、`sourceNote`

`actual` 是二季度采集期内截至导出时点的有效完成数；`abnormal` 可填 `0.08` 或 `8%`。上传后柱状图、折线图、热力图、全国办事处地图、品牌矩阵和公式会即时重算。Word 不适合作为数据更新源。当前异常扣分不自动计入，需复核后再纳入最终得分。
