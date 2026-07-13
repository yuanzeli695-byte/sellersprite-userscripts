# SellerSprite Userscripts

这个仓库把 SellerSprite/Amazon 选品脚本纳入 Git 版本管理，并让 ScriptCat 从固定 GitHub 地址检查更新。

## 项目报告

完整的候选发现、SellerSprite 数据采集、严格筛选、历史排重、工作簿生成和验收流程，见 [亚马逊美国站选品自动化流程与数据处理报告（2026-07-13）](docs/亚马逊美国站选品自动化流程与数据处理报告_20260713.docx)。

该报告是 2026-07-13 的完整流程快照。报告中的 Collector 0.4.3 / Runner 0.3.5 属于生成报告时的完整业务环境；本报告归档时，本仓库发布的是 Collector 0.4.4 / Runner 0.3.4。后续版本请以 `scripts/*.user.js` 的 `@version` 元数据为准。

## 脚本

| 脚本 | 用途 | 安装地址 |
| --- | --- | --- |
| SellerSprite Traffic Collector MVP | 读取近期自然流量并输出标准 JSON | [安装 Collector](https://raw.githubusercontent.com/yuanzeli695-byte/sellersprite-userscripts/main/scripts/sellersprite-traffic-collector.user.js) |
| SellerSprite Integrated Runner | 批量处理 ASIN，串联流量、尺寸和价格门槛 | [安装 Integrated Runner](https://raw.githubusercontent.com/yuanzeli695-byte/sellersprite-userscripts/main/scripts/sellersprite-integrated-runner.user.js) |

Integrated Runner 依赖 Collector 提供的 `#ss-collector-panel`、`#ss-collector-run` 和 `#ss-collector-json` 接口，以及版本化的 run/result 状态属性。两个脚本都要启用，Collector 应先安装。

## 协同模型

GitHub 仓库是唯一源代码。VS Code 保存文件时把本地改动同步到 Chrome 的 ScriptCat；提交并推送到 GitHub 后，ScriptCat 再通过 `@updateURL` 和 `@downloadURL` 为其他安装自动更新。

这不是双向自动合并：直接在 ScriptCat 编辑器中修改的代码不会自动写回 Git。临时在浏览器里改过后，需要手动带回仓库再提交。

## 首次连接

1. 该仓库必须公开，ScriptCat 才能匿名读取 GitHub Raw 更新地址。现有私有仓库 `New-project-2` 不适合直接作为自动更新源。
2. 在 VS Code 安装推荐扩展 `CodFrm.scriptcat-vscode`。打开本仓库时，VS Code 会显示推荐提示。
3. 在 ScriptCat 管理面板进入“工具 > 开发工具”，启用“自动连接 VSCode 服务”并点击“连接”。
4. 在 VS Code 按 `Ctrl+Shift+P`，运行 `scriptcat.autoTarget`。
5. 打开或保存 `scripts/*.user.js`，脚本会自动同步到 ScriptCat。
6. 首次从上表地址重新安装两个脚本。旧的 `SellerSprite Integrated Runner 0.3.3` 名称包含版本号，应在确认新脚本正常后禁用或删除，避免重复运行。

## 发布更新

修改代码后必须递增 `@version`。仓库提供了同步更新元数据版本和面板版本的命令：

```powershell
npm run version:integrated -- 0.3.5
npm run version:collector -- 0.4.5
npm test
git add .
git commit -m "release: integrated runner 0.3.5"
git push
```

GitHub Raw 通常会缓存几分钟。推送后 ScriptCat 暂时读取到旧文件时，稍后再检查更新即可。

## 本地验证

```powershell
npm test
```

验证内容包括：

- 两个用户脚本的 JavaScript 语法。
- `@version` 与运行时版本一致。
- GitHub 更新地址、依赖 DOM 接口和 Collector 协议完整。
- 流量 70% 门槛、最少周数、ASIN 重定向、尺寸和价格趋势核心规则。
- 批次名称不再通过 `innerHTML` 注入选项。

GitHub Actions 会在每次 push 和 pull request 时执行同一组检查。

## 数据与隐私

脚本不包含 API key、密码或远程数据上报。Integrated Runner 会在 `amazon.com` 的 `localStorage` 中保存批次 ASIN、operator 和采集结果，以便跨商品页面恢复进度；Amazon 同源页面中的其他脚本理论上也能读取这些数据。Collector 不再额外持久化流量结果。不要在 operator 或 batchName 中填写敏感信息。

脚本依赖 SellerSprite 浏览器扩展渲染的页面元素。SellerSprite 页面结构变化时，采集器可能需要同步调整。
