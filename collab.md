# 协作约定：CLAUDE 负责框架，GPT 负责美术

本文件规定两个 AI 的分工与红线。**任何一方开工前先读本文件。**
具体的交接任务写在 [bridge.md](./bridge.md)，本文件只定规则，不记任务。

项目是「艾宾浩斯复习本」，一个考研用的间隔重复 App，同时发布网页版和安卓 APK。
技术栈 Vite + React + TypeScript + Dexie + Capacitor。

---

## 一、角色

| | CLAUDE | GPT |
|---|---|---|
| 职责 | 框架、数据、算法、构建、发布 | 视觉设计：配色、排版、组件外观、图标、打卡图 |
| 产出 | `.ts` / `.tsx` / 构建脚本 / 测试 | `tokens.css` / `components.css` / `cardTheme.ts` / 图标 PNG |
| 验收 | 跑测试与构建，确认不破坏功能 | 提供可直接粘贴的完整文件内容 |

GPT 不执行命令，也不提交代码。GPT 的产物由 CLAUDE 落盘、验证、提交，结果回写到 bridge.md。

---

## 二、文件归属

**只有归属方可以修改对应文件。** 需要动别人的文件，走 bridge.md 提需求。

### GPT 独占

| 文件 | 内容 |
|---|---|
| `src/styles/tokens.css` | 设计变量：颜色、圆角、阴影、尺寸。浅色与深色两套 |
| `src/styles/components.css` | 组件外观：按钮、卡片、输入框、标签、底部导航、目标卡、打卡图弹窗等 |
| `src/share/cardTheme.ts` | 打卡图的视觉规格。**只改 `CARD_THEME` 的值，不改 `interface` 定义** |
| `android/app/src/main/res/mipmap-*/` `drawable-*/` | 应用图标与通知图标 PNG |

### CLAUDE 独占

| 文件 | 内容 |
|---|---|
| `src/**/*.ts` `src/**/*.tsx` | 全部逻辑与组件结构（`cardTheme.ts` 除外） |
| `src/styles/base.css` | 重置、排版基准、布局骨架、安全区 |
| `src/styles/global.css` | 样式入口，只有三行 `@import` |
| `src/share/renderCard.ts` | 打卡图渲染逻辑 |
| `scripts/` `android/`（图标目录除外）`package.json` `vite.config.ts` | 构建与发布 |

### 共同只读

`src/db/`、`src/scheduler/`、`src/sync/` 属于数据与算法核心，GPT 不要修改，CLAUDE 修改需保证单元测试通过。

---

## 三、红线

### GPT 不可以

1. **改任何 `.ts` / `.tsx`**，唯一例外是 `cardTheme.ts` 里 `CARD_THEME` 的取值。
2. **删除或重命名已有的 CSS 变量、class 名、`CardTheme` 字段**。新增可以，删除会让组件失效。
3. **改动功能性 CSS 属性**。以下属性关系到浮层、遮挡编辑、底部导航能否正常工作，一律不动：
   `position`、`inset` / `top` / `left` / `right` / `bottom`、`z-index`、`overflow`、
   `aspect-ratio`、`touch-action`、`pointer-events`、以及 flex / grid 的骨架声明
   （`display:flex|grid`、`flex-direction`、`grid-template-*`）。
   可以自由改：颜色、字号、字重、行高、圆角、阴影、边框、内外边距、间距、过渡动画。
4. **引入外部资源**：网络字体、CDN、远程图片、新的 npm 依赖。App 必须离线可用，且页面有内容安全策略限制。
5. **只做浅色忘了深色**。`tokens.css` 里的深色覆盖必须同步更新。
6. **破坏窄屏**。最小适配宽度 360px，底部导航与安全区留白不能丢。

### CLAUDE 不可以

1. **擅自改 GPT 独占文件里的视觉取值**。只有两种情况可以动：
   - 新增组件时写一份能用的占位样式，并在 bridge.md 登记，交给 GPT 重做；
   - 修复明确的功能性缺陷（例如浮层被遮挡），需在 bridge.md 写明改了什么。
2. **重命名或删除已有 class 名**而不通知。必须改时，在 bridge.md 登记新旧对照。
3. **新增组件却不登记**。凡是新增的 class 名和 DOM 结构，都要写进 bridge.md，否则 GPT 不知道要给什么上样式。

### 双方都不可以

1. 碰签名密钥与私密配置：`android/keystore.properties`、`D:\dev\keys\`、同步令牌。
2. 把用户笔记、照片、备份文件提交进仓库。
3. 改 `.gitignore` 里排除密钥的那几行。
4. 未经本人同意，改变数据格式使旧备份无法导入。
5. 绕过验收直接提交。

---

## 四、流程

1. **CLAUDE 发起**：在 bridge.md 的「待办」里新建条目，写清目标、涉及文件、现状截图或 class 清单、验收标准。
2. **GPT 交付**：针对条目给出**完整文件内容**（不要给片段或 diff，直接可覆盖粘贴），写在条目的「交付」里。
3. **CLAUDE 落盘验收**：粘贴进仓库，跑验收命令，在条目里写「已合并」或「打回 + 原因」。
4. 条目完成后移到「已完成」区，保留记录。

任务编号用 `T-001` 递增，不复用。

---

## 五、验收命令

CLAUDE 在合并 GPT 的改动后必须全部跑通：

```powershell
npm test          # 单元测试
npm run build     # 类型检查 + 生产构建
npm run dev       # 另开终端，供下面的冒烟测试使用
npm run smoke     # 端到端冒烟测试，会走完录入、复习、遮挡、备份、目标等流程
```

视觉改动还要人工确认：

- 浅色与深色两种模式；
- 360px 窄屏下不横向滚动，底部导航不遮内容；
- 打卡图在 1080×1440 下文字不溢出、不重叠。

任何一项不过，改动打回，不进主分支。
