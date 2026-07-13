# 配置说明

本文对应当前版本：Integrated Runner `0.3.7`、Traffic Collector `0.4.6`。

## 1. 安装顺序

1. 在 Chrome 安装并登录 SellerSprite 扩展。
2. 在 ScriptCat 中安装 [Traffic Collector 0.4.6](https://raw.githubusercontent.com/yuanzeli695-byte/sellersprite-userscripts/main/scripts/sellersprite-traffic-collector.user.js)。
3. 再安装 [Integrated Runner 0.3.7](https://raw.githubusercontent.com/yuanzeli695-byte/sellersprite-userscripts/main/scripts/sellersprite-integrated-runner.user.js)。
4. 停用旧版 Runner、Collector 和重复脚本，只保留这一对。
5. 打开新的 Amazon.com 商品详情页，确认两个面板都出现。

Runner 和 Collector 必须配套使用。两者当前协议仍为 `1`，Collector Schema 为 `sellerSpriteTraffic/v1`；Runner 会校验协议、Schema、run ID 和结果所属的 run ID，防止读到旧结果。

## 2. 面板字段

| 字段 | 作用 | 建议 |
| --- | --- | --- |
| `batchName` | 本地批次名称 | 使用日期或项目名，不要放密码、Token 或客户信息 |
| `operator` | 操作人标记 | 仅用于结果和日志，可留空或填内部代号 |
| `targetQualified` | 达到多少个严格合格 ASIN 后停止 | 按本次任务填写，默认 `20` |
| `QUEUE input` | ASIN 队列 | 一行一个 ASIN；Generate 时会自动去重和过滤本地历史 |

常用按钮：

- `Generate`：生成并保存本地批次。
- `Start` / `Pause` / `Resume`：开始、暂停和恢复导航队列。
- `Copy combined JSON`：复制完整批次结果。
- `Copy enrichment JSON`：只复制尺寸、价格趋势和原始 `priceSamples`，不含独立的现价/最低价/最高价或遥测。
- `Copy gate log TSV`：复制门槛审计表，可粘贴到 Excel。
- `Copy timing log TSV`：复制阶段耗时与重试表。
- `Clear batch`：删除当前批次，不会删除严格合格历史。

TSV 导出会把制表符/换行替换为空格，并为以 `= + - @` 开头的内容加单引号，降低粘贴到 Excel 时触发公式的风险。

## 3. Runner 配置

配置位于 `scripts/sellersprite-integrated-runner.user.js` 顶部。修改后需要在 VS Code 保存并让 ScriptCat 重新加载，或重新安装 Raw URL。

下表是公共构建的默认值。私有分支修改价格范围、最少周数、趋势白名单或功能开关后，应同步更新自己的 README/配置说明；仓库测试会继续校验脚本协议、版本和发布文档的一致性。

| 常量 | 当前值 | 作用 |
| --- | --- | --- |
| `ENABLE_TIER0_TELEMETRY` | `true` | 写入 gate/timing 遥测，并显示两个 TSV 复制按钮 |
| `ENABLE_TIER2_2_CONDITIONAL_RETRY` | `true` | 仅在图表/tooltip 尚未就绪时最多重试一次；已明确低流量时不重试 |
| `TRAFFIC_MIN_PCT` | `70` | `sellerSpriteTraffic/v1` 的固定阈值；不要在 Schema v1 下修改 |
| `MIN_REQUIRED_TRAFFIC_WEEKS` | `3` | Runner 要求的最少有效流量周数；必须与 Collector 保持一致 |
| `MAX_RECENT_TRAFFIC_WEEKS` | `4` | `recent4*` 字段对应的固定窗口；不要在 Schema v1 下修改 |
| `PRICE_MIN_USD` | `9.9` | 当前价格下限，含边界 |
| `PRICE_MAX_USD` | `50` | 当前价格上限，含边界 |
| `PRICE_TREND_ALLOWLIST` | `stable, rising` | 允许通过的价格趋势分类 |
| `BOOTSTRAP_STRICT_QUALIFIED_ASINS` | `[]` | 公开版默认空，避免把个人业务台账发布给所有安装者 |

`sellerSpriteIntegratedBatch/v0.3.0`、`sellerSpriteTraffic/v1`、`data-ss-*` 属性和 `STORAGE_PREFIX` 属于协议/存储兼容项，不要为了改显示文字而修改。

`TRAFFIC_MIN_PCT` 同时存在于 Runner 和 Collector，但公共协议字段仍命名为 `pass70` / `below_70`；最大窗口字段仍命名为 `recent4*`。因此 Schema v1 必须保持 `70%` 和最近 `4` 周，需要改变时应同时升级 Schema、字段名、规则 ID、测试和文档。

Runner 会根据有效门槛生成 `STRICT_GATE_PROFILE`，其中包含最少/最多流量周数、流量阈值、价格范围、趋势白名单、尺寸规则和 Collector Schema。历史 Schema 为 `strictQualifiedHistory/v2`；这些门槛发生变化时，自动采集写入的旧历史会失效，ASIN 将重新进入采集队列。

### 配置自己的历史 ASIN

如果你在自己的私有分支或本地副本中已有严格合格台账，可以把 ASIN 填入 `BOOTSTRAP_STRICT_QUALIFIED_ASINS`，例如：

```js
var BOOTSTRAP_STRICT_QUALIFIED_ASINS = ['B0XXXXXXXX'];
```

请将示例值替换为真实的 10 位 ASIN。新批次会自动跳过这些 ASIN；新通过全部门槛的 ASIN 也会自动写入本地历史。

`BOOTSTRAP_STRICT_QUALIFIED_ASINS` 是人工强制跳过列表，不会自动重新验证。门槛或规则改变后，必须人工复核并更新该数组；否则其中的 ASIN 仍会以新门槛指纹写回历史。

Runner 只识别 `B0[A-Z0-9]{8}` 格式。公开仓库不要提交客户或内部业务台账；需要共享时应使用私有分支或另行管理。

历史保存在 Amazon 同源 `localStorage`，主要键如下：

```text
ssIntegratedRunner:v0.3:index
ssIntegratedRunner:v0.3:selected
ssIntegratedRunner:v0.3:batch:<queueHash>
ssIntegratedRunner:v0.3:strict-qualified-history
```

只清除历史台账而保留批次时，可在 Amazon 页面 DevTools Console 执行：

```js
localStorage.removeItem('ssIntegratedRunner:v0.3:strict-qualified-history');
location.reload();
```

如果 `BOOTSTRAP_STRICT_QUALIFIED_ASINS` 不是空数组，刷新后这些预置 ASIN 会再次写入历史。要彻底清除它们，需先把预置数组改回 `[]`。

## 4. Collector 配置

配置位于 `scripts/sellersprite-traffic-collector.user.js` 顶部。

| 常量 | 当前值 | 作用 |
| --- | --- | --- |
| `ENABLE_TIER0_TELEMETRY` | `true` | 输出 `sellerSpriteTelemetry/v1` 的 gate/timing 行，并显示 TSV 复制按钮 |
| `ENABLE_TIER2_1_ZERO_SHARE_DERIVATION` | `true` | 仅在“总流量明确大于 0、自然流量明确为 0”时推导自然占比 `0%` |
| `TIER2_READER_VERSION` | `tier2.1-zero-share-v1` | 标记零占比推导算法版本 |
| `MAX_RECENT_WEEKS` | `4` | `recent4*` 字段对应的固定窗口；不要在 Schema v1 下修改 |
| `MIN_REQUIRED_WEEKS` | `3` | 至少 3 个有效周才允许通过 |
| `TRAFFIC_MIN_PCT` | `70` | `pass70` 的固定阈值；不要在 Schema v1 下修改 |

`--`、`0/0`、带问号的歧义值和缺少有效样本不会被当成零；它们会进入复核或失败路径。关闭零占比推导时，只需把 `ENABLE_TIER2_1_ZERO_SHARE_DERIVATION` 改为 `false`，其他门槛不变。

Collector 也可单独使用：`Check Page` 检查页面条件，`Collect Traffic` 手动采集，`Copy Text` / `Copy JSON` 复制结果，两个 TSV 按钮复制当前采集的门槛和耗时行。

## 5. 严格门槛顺序

Runner 对每个未被历史跳过的 ASIN 按以下顺序执行：

1. Amazon 页面 ASIN 与目标 ASIN 一致。
2. Collector 状态为 `ok`，至少 3 周，最新/均值/最低自然流量都不低于 70%，并且 `decision=pass`、`pass70=true`。
3. 商品尺寸、商品重量、包装尺寸、包装重量至少一项可读。
4. 最近有效价格在 `$9.90-$50.00`（含边界）。
5. 价格趋势为 `stable` 或 `rising`。

任一门槛失败会短路后续步骤。明确低流量不会触发条件重试；页面未加载或 tooltip 尚未就绪时，Runner 最多重试一次。

价格采集依赖 SellerSprite 页面中的“Keepa插件替代”与“近1个月”模块；模块未出现或没有有效价格样本时会记录 `price_current_missing`。

## 6. 升级迁移

从仓库旧版 `Runner 0.3.4 + Collector 0.4.4` 升级时：

1. 先暂停或完成旧批次，并复制需要保留的 JSON。
2. 安装 Collector `0.4.6`，再安装 Runner `0.3.7`。
3. 停用旧脚本，刷新新的 Amazon 商品页。
4. 重新 Generate 一个批次，不要直接把旧批次当作新版门槛结果。

新版增加了当前价格范围、历史排重和遥测字段。旧批次中的历史 `strictDecision=pass` 可能没有当前价格字段，升级后应重新采集确认；读取旧批次不会自动把旧合格行写入新版历史。

## 7. 隐私与故障排查

- 两个脚本不要求填写 API Key、密码或导出 Cookie，也不使用 `fetch`、XHR 或 WebSocket 上报数据；运行时仍依赖 Chrome 中已登录的 Amazon/SellerSprite 会话。
- Runner 的批次、历史和遥测只保存在当前浏览器的 Amazon 同源 `localStorage`；不要在 `operator` 或 `batchName` 中填写敏感信息。
- Collector 结果只保存在页面内存、DOM 和页面全局变量中，刷新页面后需要重新采集。
- 如果看到 `protocol mismatch`，说明旧 Collector 仍在运行或两份脚本版本不配套。
- 如果出现 `no_chart_loaded`、`tooltip_not_ready` 或样本不足，请保持 SellerSprite 登录，等待图表加载后再手动重试；CAPTCHA 需要人工处理。
- 页面结构或中文按钮文本变化时，请提交 Issue，并附版本、失败阶段和脱敏后的错误信息。
