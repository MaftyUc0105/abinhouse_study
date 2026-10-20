# 交接板：CLAUDE ↔ GPT

规则见 [collab.md](./collab.md)。本文件只记任务，按编号递增，编号不复用。

- **待办**：已派出、等对方交付
- **验收中**：已交付、等落盘验证
- **已完成**：记录归档，不要删

交付请给**完整文件内容**，可直接覆盖粘贴，不要给片段或 diff。

---

## 背景速览（GPT 必读）

考研用的间隔重复 App，用户每天复习知识点、给自己定当日目标、达成后生成打卡图发小红书。
手机优先，最小适配宽度 360px，有浅色和深色两套，必须离线可用。
当前视觉已由 GPT 改过一轮：暖纸底 `#f5f3ec`、深绿主色 `#17604f`、打卡图走「青黛夜色与暖纸」。

**用户给的参考：flomo 笔记**（见 `docs/design/reference/flomo-list.png`、`flomo-drawer.png`）。
用户原话是现在"太简陋"，希望往 flomo 的方向走。flomo 值得学的是这几点：

- **浅灰底 + 纯白卡片**，卡片不描边、几乎不投影，层次全靠底色差和间距拉开；
- **留白和行距都很大**，正文接近 17px、行高接近 1.75，读长段落不累；
- **绿色只出现在激活态和热力图上**，别的地方一律中性色；
- **顶部和底部的壳很轻**，内容是主角；
- **大号灰数字配小号标签**（227 笔记 / 0 标签 / 176 天），以及一块贡献热力图。

后续任务都按这个方向推进。

**现有设计变量**（`src/styles/tokens.css`，名字不能改，值随便改，可新增）：

```
语义色   --primary --primary-text --primary-soft
         --ok --ok-soft  --warn --warn-soft  --danger --danger-soft  --info --info-soft
中性色   --bg --surface --surface-2 --border --text --text-2 --text-3
其他     --radius --shadow --tabbar-h --safe-top --safe-bottom
```

**现有 class 清单**（`src/styles/components.css`，名字不能改）：

```
基础    .card .card-link .list .empty .empty-icon .section-title .hint .error .toast
按钮    .btn .btn-primary .btn-danger .btn-ghost .btn-soft .btn-block .btn-lg .btn-sm .btn-icon
表单    .field .input .textarea .textarea-sm .select .switch .setting-row .search-row .scroll-x
标记    .chip .chip-active .chip-btn
        .badge .badge-focus .badge-attention .badge-normal .badge-solid .badge-new .badge-overdue
        .stage-dots .exam-countdown .sync-status .backup-ok .backup-reminder
导航    .tabbar .tab .tab-count
今日    .banner .banner-num
目标    .goal-card .goal-card-head .goal-card-title .goal-card-hint .goal-card-body .goal-card-side
        .goal-ring .goal-ring-svg .goal-ring-track .goal-ring-fill .goal-ring-center
        .goal-ring-label .goal-ring-sub .goal-tasks .goal-task .goal-task-text
        .goal-actions .goal-streak .goal-quick .goal-editor
复习    .review-progress .review-title .review-actions .review-actions-inner .page-review
        .rating-bar .rating-btn .rating-0 .rating-1 .rating-2 .rating-3
        .rating-label .rating-label-0 .rating-label-1 .rating-label-2 .rating-label-3 .kbd-hint
图片    .thumb-grid .thumb .thumb-actions .thumb-badge .photo-list .picker-buttons
        .occluded .occluded-fit .mask .mask-cover .mask-open .mask-edit .mask-draft
        .mask-editor .mask-editor-body .mask-canvas .mask-toolbar .mask-toolbar-2 .mask-count .mask-hint
        .lightbox .lightbox-top .lightbox-body .lightbox-nav
弹窗    .overlay .dialog .dialog-actions
打卡图  .share-card-dialog .share-card-preview .share-card-placeholder
        .share-card-actions .share-card-caption
统计    .stat-grid .stat-tile .bar .bar-row .timeline .timeline-item
内容    .markdown（及其后代 h1-h3 / ul / pre / code / blockquote / table / img / hr）
```

---

## 待办

### T-013 评分按钮的视觉权重

**目标**：复习页四个评分按钮现在权重不均，影响选择。

**现状**：见 `docs/design/review.png`、`dark-review.png`。
忘了是深红实心、模糊是赭色实心，两个"负面"选项最抢眼；记得是浅绿、很熟几乎是白底，
很熟看着像被禁用。实际使用中四档出现频率相近，不该让负面选项占据视觉中心。

**要求**

- 四档权重接近，靠色相区分而不是靠明度深浅；
- 色盲用户也要能区分，不能只靠红绿；
- 仍要一眼看出这是一个从"忘了"到"很熟"的序列；
- 按钮高度不低于 56px，手指误触代价高；
- `.review-actions` 的 `position: fixed` 与安全区内边距不要动。

**涉及文件**：`src/styles/components.css` 的 `.rating-btn` 与 `.rating-0` 到 `.rating-3`（完整交付整个文件）

---

### T-014 统计页：把 14 行条形换成热力图

**目标**：学 flomo 的贡献热力图。用户是 424 天的长线备考，更需要"整体坚持得怎么样"，
而不是逐日的条形。

**现状**：见 `docs/design/stats.png`。「最近 14 天复习量」是 14 行条形，大部分是 0，
占掉大半屏还看不出趋势。

**这一项需要 CLAUDE 先改结构**，GPT 等结构出来再上样式。CLAUDE 会提供：

```html
<div class="heatmap" role="img" aria-label="最近 N 周的每日复习量">
  <div class="heatmap-grid">
    <i class="heatmap-cell" data-level="0..4" title="10-20 复习 12 条"></i>
    …
  </div>
  <div class="heatmap-legend">…</div>
</div>
```

**要给 GPT 的要求**：五档颜色（0 到 4）要能一眼排序，0 档不能是纯空白否则看不出网格；
深色模式下同样成立；格子在 360px 宽屏幕上要排得下大约 13 周。

**状态**：等 CLAUDE 出结构。GPT 暂不动手。

---

### T-015 全局留白与行距对齐 flomo

**目标**：GPT 这一轮已经把配色统一了，但间距和行距还是偏紧，离 flomo 的松弛感有距离。

**现状**：对照 `docs/design/library.png` 与 `docs/design/reference/flomo-list.png`。
flomo 的卡片内边距约 20px、正文约 17px、行高约 1.75、卡片间距约 14px，而且**卡片不描边**。
我们现在卡片还有 1px 边框，正文 15px，行高 1.5。

**要求**

- 正文字号和行高往上调，长笔记正文要好读；
- 卡片靠底色差和间距分隔，边框能去就去，保留极轻的投影即可；
- 列表项之间的呼吸感加大，但一屏仍要能看到三条以上笔记；
- 深色模式下"底色差"同样要成立，深色里纯黑卡片配深灰底是看不出层次的；
- 不要动任何功能性属性。

**涉及文件**：`src/styles/tokens.css`、`src/styles/components.css`（都完整交付）

---

（空）

---

## 已完成

---

## 本批验收结论（CLAUDE，2026-10-20）

T-001 / T-003 / T-004 / T-005 / T-006 一次性交付，**全部已合并**。

**红线自查**

| 检查项 | 结果 |
|---|---|
| CSS 变量是否被删改 | 23 个全部保留，新增 3 个（`--focus-ring` `--overlay-scrim` `--panel-highlight`） |
| class 名是否被删改 | 138 个进 138 个出，无删除、无重命名 |
| 功能性属性（position / inset / z-index / overflow / aspect-ratio / touch-action / pointer-events / flex 骨架） | 逐条比对取值，无删除、无改动 |
| 深色模式 | 覆盖 22 个变量 |
| 外部字体、图片、CDN | 无 |

**验收命令**：`npm test` 74 项通过，`npm run build` 通过，`npm run smoke` 61 项通过，无控制台报错。
CSS 产物从 18.2 KB 增到 24.8 KB（gzip 5.7 KB），可接受。

**视觉验收**：`npm run shots` 重拍 26 张，浅色深色各页都看过，没有错位、没有不可读的配色。
暖纸底配深绿与打卡图是同一套语言，应用和分享图终于对上了。

**T-005 图标**：四个 SVG 存进 `docs/design/icons/`，新增 `npm run icons`（`scripts/export-icons.mjs`）
用 Chromium 光栅化成 23 个 PNG，覆盖五种屏幕密度的启动图标、圆形图标、自适应前景、通知小图标，
以及网页端的 192 / 512 / maskable。已核对：通知图标是 30% 不透明的白色剪影加透明底，
自适应前景占 22% 居中不会被裁，maskable 满版底色。`ic_launcher_background.xml` 同步改成 `#17604f`。


### T-001 设计变量改版（tokens.css）

**目标**：定一套真正的配色与基础度量，替换开发期的临时值。现在是直接用的 Tailwind 默认蓝，缺乏辨识度。

**要求**

- 场景是长期备考，每天看，**久看不累**比抢眼重要。深色模式会在夜里用，不要纯黑配纯白。
- 主色要能同时用于按钮底色和细小文字，`--primary` 落在白底上做正文链接时对比度需达到 4.5:1。
- `--ok` 表示达成，`--warn` 表示连续天数与注意，`--danger` 表示忘了与删除。四个评分按钮分别是忘了、模糊、记得、很熟，色相要能一眼区分，且色盲用户也能靠明度区分。
- 浅色与深色都要给全。深色下 `--surface` 与 `--bg` 必须有可见层次差。
- 可新增变量，比如字阶、间距、额外的中性色。新增的要在交付里说明用途。

**涉及文件**：`src/styles/tokens.css`（完整交付）

**验收**：对比度达标；深浅两套齐全；变量名无删改。

**GPT 交付（待 CLAUDE 落盘验收）**

浅色主色 `#17604f` 在白底上的对比度约 **7.44:1**。新增 `--focus-ring` 用于输入与按钮聚焦描边，`--panel-highlight` 用于目标卡的温和底色，`--overlay-scrim` 用于弹窗遮罩。以下是 `src/styles/tokens.css` 的**完整文件内容**：

```css
/* =============================================================
   设计变量：青黛与暖纸
   负责人：GPT（美术）。详见仓库根目录 collab.md。
   ============================================================= */

:root {
  color-scheme: light dark;
  --bg: #f5f3ec;
  --surface: #fffdf8;
  --surface-2: #edece3;
  --border: #d7dcd1;
  --text: #24332f;
  --text-2: #4d625a;
  --text-3: #66796f;
  --primary: #17604f;
  --primary-text: #ffffff;
  --primary-soft: #dcece2;
  --danger: #a43d3a;
  --danger-soft: #f7e5df;
  --warn: #945a1c;
  --warn-soft: #f4e8d0;
  --ok: #276b4d;
  --ok-soft: #e1f0e2;
  --info: #315e85;
  --info-soft: #e0ebf3;
  --radius: 16px;
  --tabbar-h: 60px;
  --safe-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  --safe-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  --shadow: 0 3px 18px rgba(31, 58, 45, 0.055);
  --focus-ring: 0 0 0 3px rgba(23, 96, 79, 0.18);
  --panel-highlight: #f7f6ed;
  --overlay-scrim: rgba(22, 36, 30, 0.54);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151d1c;
    --surface: #202c29;
    --surface-2: #2b3934;
    --border: #40534a;
    --text: #e7eee6;
    --text-2: #bfd0c3;
    --text-3: #9eb4a5;
    --primary: #8ed5b9;
    --primary-text: #17372d;
    --primary-soft: #28473b;
    --danger: #f2aaa0;
    --danger-soft: #4b302e;
    --warn: #f0bc76;
    --warn-soft: #4b3928;
    --ok: #9fdfb5;
    --ok-soft: #294638;
    --info: #a9cbe8;
    --info-soft: #293d4e;
    --shadow: 0 3px 18px rgba(0, 0, 0, 0.17);
    --focus-ring: 0 0 0 3px rgba(142, 213, 185, 0.22);
    --panel-highlight: #26382f;
    --overlay-scrim: rgba(6, 13, 10, 0.7);
  }
}
```


---

### T-003 每日目标卡片（components.css 的 .goal-* 部分）

**目标**：这是首页最重要的模块，用户每天第一眼看到它。现在只是个带圆环的普通卡片，没有「今天必须做到」的紧迫感。

**现状**：未达成态见 `docs/design/goal-active.png`，达成态见 `docs/design/goal-achieved.png`。

**DOM 结构**（CLAUDE 维护，不要改，只上样式）

```html
<section class="card goal-card" data-state="none|active|achieved|missed">
  <div class="goal-card-head">
    <b class="goal-card-title">今天的目标</b>
    <span class="goal-streak">连续达成 5 天</span>
  </div>
  <p class="goal-card-hint">...</p>          <!-- 仅 data-state="none" -->
  <div class="goal-card-body">
    <div class="goal-ring">
      <svg class="goal-ring-svg" viewBox="0 0 120 120">
        <circle class="goal-ring-track" r="52"/>
        <circle class="goal-ring-fill"  r="52"/>  <!-- 进度靠 stroke-dasharray 控制 -->
      </svg>
      <div class="goal-ring-center">
        <b class="goal-ring-label">12/40</b>
        <span class="goal-ring-sub">复习</span>
      </div>
    </div>
    <div class="goal-card-side">…文字若干…</div>
  </div>
  <ul class="goal-tasks">
    <li class="goal-task is-done"><label><input type="checkbox"><span class="goal-task-text">…</span></label></li>
  </ul>
  <div class="goal-actions">…按钮若干…</div>
</section>
```

**要求**

- 四种 `data-state` 要有清晰的视觉区别：`none` 未定目标偏邀请感，`active` 进行中，`achieved` 达成要有奖赏感，`missed` 未达成要克制。
- `.goal-streak` 连续天数是正反馈的核心，天数越多越该显眼，但只有一套样式，自己把握分寸。
- 圆环 `stroke-width` 可以改，但 `.goal-ring-fill` 的 `stroke-dasharray` / `stroke-dashoffset` 由脚本控制，不要在 CSS 里覆盖。
- 已完成任务当前是删除线加灰字，可以换更好的表达。

**涉及文件**：`src/styles/components.css`（完整交付整个文件）

**验收**：四种状态截图自查；360px 宽不折行错位；深色模式正常。

**GPT 交付**：与 T-004、T-006 合并为一份完整的 `components.css`，见 T-006 的联合交付。

---

### T-004 复习页与评分按钮

**目标**：复习是每天停留最久的页面，现在四个评分按钮是四块纯色方块，廉价。

**现状**：见 `docs/design/review.png`。

**结构**：底部固定 `.review-actions` 里是 `.rating-bar`，内含四个 `.rating-btn`，分别带 `.rating-0`（忘了）到 `.rating-3`（很熟）。按钮内有主文字和一行小字（显示下次间隔天数）。顶部是 `.review-progress` 进度条，内容区是 `.review-title`。

**要求**：四档要靠颜色与形态区分，手指误触代价高，按钮高度不低于 56px。`.review-actions` 的 `position:fixed` 和安全区内边距不要动。

**涉及文件**：`src/styles/components.css`

**GPT 交付**：与 T-003、T-006 合并为一份完整的 `components.css`，见 T-006 的联合交付。

---

### T-005 应用图标与通知图标

**目标**：现在是程序生成的蓝底白「忆」字，粗糙。

**需要的文件**

| 用途 | 路径 | 尺寸 |
|---|---|---|
| 启动图标 | `android/app/src/main/res/mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png` | 48 / 72 / 96 / 144 / 192 |
| 圆形图标 | 同上目录 `ic_launcher_round.png` | 同上 |
| 自适应前景 | 同上目录 `ic_launcher_foreground.png` | 108 / 162 / 216 / 324 / 432，**图形须在中央 2/3 内**，四周留白会被系统裁切 |
| 通知小图标 | `android/app/src/main/res/drawable-{m,h,xh,xxh,xxxh}dpi/ic_stat_icon_config_sample.png` | 24 / 36 / 48 / 72 / 96，**纯白色加透明背景**，系统会把它整体染色 |
| 网页图标 | `public/icons/icon-192.png`、`icon-512.png`、`icon-512-maskable.png`、`icon.svg` | 见文件名 |

自适应图标的底色在 `android/app/src/main/res/values/ic_launcher_background.xml`。

**要求**：小到 48px 仍可辨认；通知图标只有单色剪影，细节要砍掉。

**交付方式**：GPT 无法直接产出 PNG，请给出图形的 SVG 源码与配色说明，CLAUDE 负责导出各尺寸 PNG。

**GPT 交付（待 CLAUDE 导出并验收）**

图形为“展开的复习本＋今日圆点”。配色：青黛 `#17604f`（图标底色，也用于 `ic_launcher_background.xml`），暖纸 `#f9f5e9`（书页），金杏 `#e8b96f`（今日圆点）。不使用文字或字体。自适应前景全部图形位于 108×108 画布的 x=22–86、y=20–81，处于中央 2/3 安全区。

用于 `public/icons/icon.svg`、普通启动图标 PNG 和网页图标 PNG 的**完整 SVG**：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" role="img" aria-label="艾宾浩斯复习本">
  <rect width="108" height="108" rx="25" fill="#17604f"/>
  <circle cx="54" cy="27" r="7" fill="#e8b96f"/>
  <path d="M22 41c11-5 23-4 32 3v37c-9-7-21-9-32-5V41Z" fill="#f9f5e9"/>
  <path d="M86 41c-11-5-23-4-32 3v37c9-7 21-9 32-5V41Z" fill="#f9f5e9"/>
  <path d="M54 44v37" stroke="#a9caba" stroke-width="3" stroke-linecap="round"/>
</svg>
```

用于全部 `ic_launcher_foreground.png` 的**透明前景 SVG**：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <circle cx="54" cy="27" r="7" fill="#e8b96f"/>
  <path d="M22 41c11-5 23-4 32 3v37c-9-7-21-9-32-5V41Z" fill="#f9f5e9"/>
  <path d="M86 41c-11-5-23-4-32 3v37c9-7 21-9 32-5V41Z" fill="#f9f5e9"/>
  <path d="M54 44v37" stroke="#a9caba" stroke-width="3" stroke-linecap="round"/>
</svg>
```

用于全部 `ic_launcher_round.png` 的**圆形 SVG**：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <circle cx="54" cy="54" r="54" fill="#17604f"/>
  <circle cx="54" cy="27" r="7" fill="#e8b96f"/>
  <path d="M22 41c11-5 23-4 32 3v37c-9-7-21-9-32-5V41Z" fill="#f9f5e9"/>
  <path d="M86 41c-11-5-23-4-32 3v37c9-7 21-9 32-5V41Z" fill="#f9f5e9"/>
  <path d="M54 44v37" stroke="#a9caba" stroke-width="3" stroke-linecap="round"/>
</svg>
```

用于 `ic_stat_icon_config_sample.png` 的**纯白透明 SVG**。删去书脊和圆点，仅保留高辨识度的单色展开书页：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <path d="M18 32c13-6 27-5 36 3v49c-10-8-23-10-36-6V32Z" fill="#ffffff"/>
  <path d="M90 32c-13-6-27-5-36 3v49c10-8 23-10 36-6V32Z" fill="#ffffff"/>
</svg>
```

`icon-512-maskable.png` 采用**不带圆角**的 `#17604f` 满版底色，上面叠加同一透明前景；普通 PNG 可从完整方形 SVG 导出。各 Android 密度尺寸按任务表导出，通知图标必须保留透明背景。

---

### T-006 其余组件外观

在 T-001 定下变量后，统一梳理按钮、输入框、chip、badge、底部导航、今日 banner、统计页、弹窗的外观。
与 T-003、T-004 在同一个 `components.css` 里，建议等前面几项定稿后一次性交付，避免互相覆盖。

**GPT 联合交付（T-003、T-004、T-006；待 CLAUDE 落盘验收）**

以下是 `src/styles/components.css` 的**完整文件内容**。保留原有功能性布局规则与全部 class，文件末尾为三项设计任务的视觉覆盖样式。覆盖样式同时处理浅色和深色，四档评分按钮最小高度 68px。

```css
/* =============================================================
   组件外观
   负责人：GPT（美术）。详见仓库根目录 collab.md。
   可以改：颜色、字号字重、圆角、阴影、边框、内外边距、过渡动画。
   不要改：position / inset / z-index / display 的 flex|grid 结构 /
           overflow / aspect-ratio / touch-action / pointer-events，
           以及任何既有 class 名称。这些关系到功能，改了会让浮层、
           遮挡编辑、底部导航失效。
   改完请跑：npm test && npm run smoke
   ============================================================= */

/* ---- 卡片 ---- */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow);
}
.card-link {
  display: block;
  color: inherit;
}
.card-link:active {
  background: var(--surface-2);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 48px 16px;
}
.empty-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

/* ---- 按钮 ---- */
.btn {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  line-height: 1.2;
  transition: opacity 0.15s, transform 0.05s;
}
.btn:active {
  transform: scale(0.98);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-text);
}
.btn-danger {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}
.btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--primary);
}
.btn-soft {
  background: var(--surface-2);
  border-color: transparent;
}
.btn-block {
  width: 100%;
}
.btn-lg {
  min-height: 52px;
  font-size: 17px;
}
.btn-sm {
  min-height: 34px;
  padding: 6px 12px;
  font-size: 14px;
}
.btn-icon {
  min-height: 36px;
  min-width: 36px;
  padding: 6px;
}

/* ---- 表单 ---- */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 14px;
  color: var(--text-2);
  font-weight: 500;
}
.input,
.textarea,
.select {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 16px;
  font-family: inherit;
  outline: none;
}
.input:focus,
.textarea:focus,
.select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.textarea {
  min-height: 50vh;
  resize: vertical;
  line-height: 1.5;
}
.textarea-sm {
  min-height: 100px;
}
.hint {
  font-size: 12px;
  color: var(--text-3);
}
.error {
  color: var(--danger);
  font-size: 14px;
}

/* ---- Chip / Badge ---- */
.chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--surface-2);
  color: var(--text-2);
  white-space: nowrap;
}
.chip-active {
  background: var(--primary);
  color: var(--primary-text);
}
.chip-btn {
  border: none;
  cursor: pointer;
  font-family: inherit;
  min-height: 32px;
  padding: 4px 14px;
  font-size: 14px;
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.badge-focus {
  background: var(--danger-soft);
  color: var(--danger);
}
.badge-attention {
  background: var(--warn-soft);
  color: var(--warn);
}
.badge-normal {
  background: var(--surface-2);
  color: var(--text-2);
}
.badge-solid {
  background: var(--ok-soft);
  color: var(--ok);
}
.badge-new {
  background: var(--info-soft);
  color: var(--info);
}
.badge-overdue {
  background: var(--danger-soft);
  color: var(--danger);
}

/* ---- 底部 Tab ---- */
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--tabbar-h) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-around;
  z-index: 50;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-3);
  font-size: 11px;
  position: relative;
}
.tab svg {
  width: 24px;
  height: 24px;
}
.tab.active {
  color: var(--primary);
}
.tab-count {
  position: absolute;
  top: 6px;
  left: calc(50% + 6px);
  background: var(--danger);
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

/* ---- Banner ---- */
.banner {
  background: var(--primary-soft);
  color: var(--text);
  border-radius: var(--radius);
  padding: 14px 16px;
}
.banner-num {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1.1;
}

/* ---- Markdown ---- */
.markdown {
  word-break: break-word;
  overflow-wrap: anywhere;
}
.markdown > :first-child {
  margin-top: 0;
}
.markdown > :last-child {
  margin-bottom: 0;
}
.markdown h1,
.markdown h2,
.markdown h3 {
  margin: 16px 0 8px;
}
.markdown h1 {
  font-size: 20px;
}
.markdown h2 {
  font-size: 18px;
}
.markdown h3 {
  font-size: 16px;
}
.markdown ul,
.markdown ol {
  padding-left: 22px;
  margin: 8px 0;
}
.markdown pre {
  background: var(--surface-2);
  padding: 10px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 14px;
}
.markdown code {
  background: var(--surface-2);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 0.92em;
}
.markdown pre code {
  background: none;
  padding: 0;
}
.markdown blockquote {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid var(--primary);
  color: var(--text-2);
}
.markdown table {
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
  max-width: 100%;
}
.markdown th,
.markdown td {
  border: 1px solid var(--border);
  padding: 4px 8px;
}
.markdown img {
  max-width: 100%;
}
.markdown hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 12px 0;
}

/* ---- 图片 ---- */
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-2);
  border: 1px solid var(--border);
  cursor: pointer;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-actions {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  justify-content: space-between;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  padding: 4px;
}
.thumb-actions button {
  appearance: none;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: #111;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-actions .del {
  background: var(--danger);
  color: #fff;
}
.photo-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.photo-list > img {
  width: 100%;
  height: auto;
  border-radius: 10px;
  border: 1px solid var(--border);
  display: block;
  cursor: zoom-in;
}
.picker-buttons {
  display: flex;
  gap: 8px;
}
.picker-buttons .btn {
  flex: 1;
}

/* ---- Lightbox ---- */
.lightbox {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 100;
  display: flex;
  flex-direction: column;
  touch-action: pinch-zoom;
}
.lightbox-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  color: #fff;
  padding-top: calc(10px + var(--safe-top));
}
.lightbox-top button {
  appearance: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 15px;
  cursor: pointer;
}
.lightbox-body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* ---- 遮挡 ---- */
.occluded {
  position: relative;
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-2);
  cursor: zoom-in;
  user-select: none;
  -webkit-user-select: none;
}
.occluded img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.occluded-fit {
  display: inline-block;
  width: auto;
  border: none;
  border-radius: 0;
  background: none;
  cursor: default;
  line-height: 0;
}
.occluded-fit img {
  width: auto;
  height: auto;
  max-width: 100vw;
  max-height: calc(100dvh - 130px);
}
.mask {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.mask-cover {
  background: #f59e0b;
  border: 1px solid #b45309;
  color: #fff;
  cursor: pointer;
  border-radius: 3px;
}
.mask-open {
  border: 2px solid #f59e0b;
  background: rgba(245, 158, 11, 0.08);
  border-radius: 3px;
  pointer-events: auto;
}
.mask-edit {
  background: rgba(245, 158, 11, 0.55);
  border: 2px solid #f59e0b;
  color: #fff;
  border-radius: 3px;
}
.mask-edit.is-selected {
  background: rgba(220, 38, 38, 0.55);
  border-color: #dc2626;
}
.mask-draft {
  border: 2px dashed #2563eb;
  background: rgba(37, 99, 235, 0.2);
}
.thumb-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #f59e0b;
  color: #fff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 600;
}
.mask-editor {
  position: fixed;
  inset: 0;
  z-index: 110;
  background: #111;
  color: #fff;
  display: flex;
  flex-direction: column;
}
.mask-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  padding-top: calc(8px + var(--safe-top));
}
.mask-toolbar-2 {
  padding-top: 0;
  justify-content: flex-start;
  overflow-x: auto;
}
.mask-toolbar button {
  appearance: none;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
}
.mask-toolbar button.on,
.mask-toolbar button.primary {
  background: #2563eb;
}
.mask-toolbar button:disabled {
  opacity: 0.35;
}
.mask-count {
  font-size: 14px;
  opacity: 0.8;
}
.mask-editor-body {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: safe center;
  align-items: flex-start;
  padding: 0 8px;
}
.mask-canvas {
  position: relative;
  flex-shrink: 0;
  line-height: 0;
  user-select: none;
  -webkit-user-select: none;
}
.mask-canvas.is-draw {
  touch-action: none;
  cursor: crosshair;
}
.mask-canvas img {
  display: block;
  height: auto;
  pointer-events: none;
}
.mask-hint {
  font-size: 12px;
  opacity: 0.7;
  text-align: center;
  padding: 6px 10px calc(8px + var(--safe-bottom));
}
.lightbox-nav {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px calc(10px + var(--safe-bottom));
}
.lightbox-nav button {
  appearance: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 15px;
  cursor: pointer;
}
.lightbox-nav button:disabled {
  opacity: 0.3;
}

/* ---- 复习 ---- */
.review-progress {
  height: 6px;
  background: var(--surface-2);
  border-radius: 3px;
  overflow: hidden;
}
.review-progress > div {
  height: 100%;
  background: var(--primary);
  transition: width 0.2s;
}
.review-title {
  font-size: 20px;
  font-weight: 600;
  white-space: pre-wrap;
  word-break: break-word;
}
.review-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 10px 12px calc(10px + var(--safe-bottom));
  z-index: 40;
}
.review-actions-inner {
  max-width: 720px;
  margin: 0 auto;
}
.rating-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.rating-btn {
  appearance: none;
  border: none;
  border-radius: 10px;
  min-height: 56px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  line-height: 1.1;
}
.rating-btn small {
  font-weight: 400;
  font-size: 11px;
  opacity: 0.9;
}
.rating-btn:active {
  transform: scale(0.97);
}
.rating-btn:disabled {
  opacity: 0.5;
}
.rating-0 {
  background: #dc2626;
}
.rating-1 {
  background: #ea580c;
}
.rating-2 {
  background: #16a34a;
}
.rating-3 {
  background: #2563eb;
}
.page-review {
  padding-bottom: 180px;
}

/* ---- 统计条 ---- */
.bar-row {
  display: grid;
  grid-template-columns: 56px 1fr 40px;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.bar {
  height: 14px;
  background: var(--surface-2);
  border-radius: 7px;
  overflow: hidden;
}
.bar > div {
  height: 100%;
  background: var(--primary);
  border-radius: 7px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.stat-tile {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 8px;
  text-align: center;
}
.stat-tile .num {
  font-size: 24px;
  font-weight: 700;
}
.stat-tile .lbl {
  font-size: 12px;
  color: var(--text-2);
}

/* ---- 时间线 ---- */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.timeline-item {
  display: grid;
  grid-template-columns: 90px 52px 1fr;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}
.timeline-item:last-child {
  border-bottom: none;
}
.rating-label {
  font-weight: 600;
}
.rating-label-0 {
  color: #dc2626;
}
.rating-label-1 {
  color: #ea580c;
}
.rating-label-2 {
  color: #16a34a;
}
.rating-label-3 {
  color: #2563eb;
}

/* ---- 对话框 ---- */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.dialog {
  background: var(--surface);
  border-radius: 14px;
  padding: 20px;
  width: 100%;
  max-width: 400px;
}
.dialog-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.dialog-actions .btn {
  flex: 1;
}

/* ---- Toast ---- */
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 14px;
  z-index: 80;
  max-width: 90vw;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* ---- 设置 ---- */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.setting-row:last-child {
  border-bottom: none;
}
.setting-row .input {
  width: 110px;
  text-align: right;
}
.switch {
  width: 48px;
  height: 28px;
  appearance: none;
  background: var(--surface-2);
  border-radius: 14px;
  position: relative;
  cursor: pointer;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.switch:checked {
  background: var(--primary);
  border-color: var(--primary);
}
.switch:checked::after {
  left: 23px;
}
.stage-dots {
  display: inline-flex;
  gap: 3px;
}
.stage-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border);
}
.stage-dots i.on {
  background: var(--primary);
}
.section-title {
  font-size: 14px;
  color: var(--text-2);
  font-weight: 600;
  margin: 16px 0 8px;
}
.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.scroll-x {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.scroll-x::-webkit-scrollbar {
  display: none;
}

/* ---- 同步 / 倒计时 / 快捷键 ---- */
.sync-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-2);
  white-space: nowrap;
}
.sync-status.sync-idle {
  color: var(--ok);
}
.sync-status.sync-dirty,
.sync-status.sync-syncing {
  color: var(--primary);
}
.sync-status.sync-error {
  background: var(--danger-soft);
  color: var(--danger);
}
b.sync-error {
  color: var(--danger);
}
b.sync-idle {
  color: var(--ok);
}
.exam-countdown {
  font-size: 12px;
  font-weight: 600;
  color: var(--danger);
  background: var(--danger-soft);
  padding: 1px 8px;
  border-radius: 6px;
}
.kbd-hint {
  display: none;
  text-align: center;
  font-size: 11px;
  color: var(--text-3);
  margin-top: 6px;
}
@media (hover: hover) and (pointer: fine) {
  .kbd-hint {
    display: block;
  }
}
.howto {
  padding-left: 20px;
  margin: 8px 0;
}
.howto li {
  margin-bottom: 4px;
}
details summary {
  cursor: pointer;
  color: var(--primary);
}

.backup-reminder {
  border-color: var(--warn);
  background: var(--warn-soft);
}
.backup-ok {
  color: var(--ok);
}


/* ---- 每日目标卡片 ---- */
.goal-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.goal-card[data-state='achieved'] {
  border-color: var(--ok);
  background: var(--ok-soft);
}
.goal-card[data-state='missed'] {
  border-color: var(--border);
}
.goal-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.goal-card-title {
  font-size: 15px;
}
.goal-streak {
  font-size: 12px;
  font-weight: 600;
  color: var(--warn);
  background: var(--warn-soft);
  padding: 2px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.goal-card-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
}
.goal-card-body {
  display: flex;
  align-items: center;
  gap: 16px;
}
.goal-ring {
  position: relative;
  width: 104px;
  height: 104px;
  flex-shrink: 0;
}
.goal-ring-svg {
  display: block;
  width: 100%;
  height: 100%;
}
.goal-ring-track {
  stroke: var(--surface-2);
  stroke-width: 11;
}
.goal-ring-fill {
  stroke: var(--primary);
  stroke-width: 11;
  transition: stroke-dashoffset 0.35s ease;
}
.goal-card[data-state='achieved'] .goal-ring-fill {
  stroke: var(--ok);
}
.goal-card[data-state='missed'] .goal-ring-fill {
  stroke: var(--text-3);
}
.goal-ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
}
.goal-ring-label {
  font-size: 19px;
  line-height: 1.1;
}
.goal-ring-sub {
  font-size: 11px;
  color: var(--text-3);
}
.goal-card-side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.goal-tasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.goal-task label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  cursor: pointer;
}
.goal-task input {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: var(--primary);
}
.goal-task-text {
  font-size: 15px;
  word-break: break-word;
}
.goal-task.is-done .goal-task-text {
  text-decoration: line-through;
  color: var(--text-3);
}
.goal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.goal-quick {
  margin-top: 6px;
}
.goal-editor {
  max-width: 440px;
}

/* ---- 打卡图 ---- */
.share-card-dialog {
  max-width: 440px;
  max-height: 88dvh;
  overflow-y: auto;
}
.share-card-preview {
  background: var(--surface-2);
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
}
.share-card-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.share-card-placeholder {
  font-size: 13px;
  color: var(--text-3);
}
.share-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.share-card-caption {
  margin: 10px 0 0;
  padding: 10px 12px;
  background: var(--surface-2);
  border-radius: 8px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-2);
  white-space: pre-wrap;
  max-height: 150px;
  overflow: auto;
}

/* ---- 青黛与暖纸：视觉改版（T-003 / T-004 / T-006） ---- */
.card {
  padding: 16px;
  box-shadow: var(--shadow);
}
.card-link:active { background: var(--panel-highlight); }
.empty { color: var(--text-2); }
.empty-icon { color: var(--primary); }
.section-title { color: var(--text-2); font-weight: 700; letter-spacing: 0.02em; }

/* 按钮与表单 */
.btn {
  border-radius: 12px;
  font-weight: 650;
  transition: background-color 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.05s;
}
.btn-primary { box-shadow: 0 3px 10px rgba(23, 96, 79, 0.16); }
.btn-primary:active { box-shadow: none; }
.btn-soft { background: var(--primary-soft); color: var(--primary); }
.btn-ghost { color: var(--primary); }
.btn:focus-visible,
.chip-btn:focus-visible,
.rating-btn:focus-visible,
.tab:focus-visible,
.switch:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.input, .textarea, .select {
  border-radius: 12px;
  padding: 11px 13px;
  background: var(--surface);
}
.input:focus, .textarea:focus, .select:focus { box-shadow: var(--focus-ring); }
.field label { color: var(--text-2); font-weight: 650; }
.hint { color: var(--text-3); }

/* 标签、导航与今日概览 */
.chip { padding: 4px 11px; font-weight: 550; }
.chip-active { box-shadow: 0 2px 8px rgba(23, 96, 79, 0.12); }
.chip-btn { border: 1px solid transparent; }
.badge { padding: 3px 9px; border-radius: 8px; font-weight: 700; }
.tabbar { background: var(--surface); border-top-color: var(--border); box-shadow: 0 -3px 14px rgba(31, 58, 45, 0.045); }
.tab { color: var(--text-2); font-size: 11px; font-weight: 600; }
.tab.active { color: var(--primary); font-weight: 750; }
.tab-count { background: var(--danger); font-weight: 700; }
.banner { background: var(--primary-soft); border: 1px solid var(--border); padding: 16px 18px; }
.banner-num { color: var(--primary); font-size: 34px; font-weight: 800; letter-spacing: -0.04em; }

/* 图文和编辑工具 */
.markdown blockquote { background: var(--panel-highlight); border-radius: 0 8px 8px 0; }
.markdown pre, .markdown code { border-radius: 7px; }
.thumb, .occluded { border-radius: 12px; }
.thumb-badge { background: var(--warn); }
.mask-cover { background: var(--warn); border-color: var(--warn); }
.mask-open { border-color: var(--warn); background: rgba(148, 90, 28, 0.11); }
.mask-edit { border-color: var(--warn); background: rgba(148, 90, 28, 0.58); }
.mask-edit.is-selected { border-color: var(--danger); background: rgba(164, 61, 58, 0.58); }
.mask-draft { border-color: var(--primary); background: rgba(23, 96, 79, 0.2); }
.mask-toolbar button.on, .mask-toolbar button.primary { background: #276b5a; }

/* 复习：四档明度逐级提升，并以不同圆角辅助识别 */
.review-progress { height: 7px; border-radius: 999px; }
.review-progress > div { background: var(--primary); }
.review-title { font-size: 21px; font-weight: 700; line-height: 1.45; }
.review-actions { background: var(--surface); border-top-color: var(--border); }
.rating-bar { gap: 7px; }
.rating-btn {
  min-height: 68px;
  padding: 8px 3px;
  border: 1px solid transparent;
  border-bottom-width: 4px;
  font-size: 15px;
  font-weight: 750;
  line-height: 1.15;
  box-shadow: 0 2px 8px rgba(19, 45, 37, 0.1);
  transition: transform 0.08s, box-shadow 0.15s;
}
.rating-btn small { font-size: 10px; font-weight: 550; opacity: 0.94; }
.rating-btn:active { box-shadow: none; }
.rating-0 { background: #793530; border-color: #602a27; color: #ffffff; border-radius: 8px; }
.rating-1 { background: #92571f; border-color: #744318; color: #ffffff; border-radius: 11px; }
.rating-2 { background: #b7d8a3; border-color: #749867; color: #234032; border-radius: 15px; }
.rating-3 { background: #e2f0eb; border-color: #85b7a9; color: #193b3a; border-radius: 19px; }
.rating-label-0 { color: var(--danger); }
.rating-label-1 { color: var(--warn); }
.rating-label-2 { color: var(--ok); }
.rating-label-3 { color: var(--info); }

/* 统计、弹窗与设置 */
.bar { background: var(--surface-2); border-radius: 999px; }
.bar > div { background: var(--primary); border-radius: 999px; }
.stat-tile { background: var(--surface); box-shadow: var(--shadow); padding: 14px 8px; }
.stat-tile .num { color: var(--primary); font-size: 26px; font-weight: 800; }
.stat-tile .lbl { color: var(--text-2); }
.timeline-item { padding: 9px 0; }
.dialog { border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 18px 46px rgba(8, 28, 20, 0.18); }
.overlay { background: var(--overlay-scrim); }
.toast { background: var(--text); color: var(--surface); box-shadow: 0 8px 24px rgba(8, 28, 20, 0.18); }
.switch { background: var(--surface-2); }
.switch::after { background: var(--surface); }
.sync-status { font-weight: 600; }
.exam-countdown { color: var(--warn); background: var(--warn-soft); border-radius: 999px; padding: 3px 9px; }
.backup-reminder { border-color: var(--warn); }

/* 每日目标：邀请、进行、达成、未达成四态 */
.goal-card {
  gap: 14px;
  padding: 18px;
  border-radius: 20px;
  box-shadow: var(--shadow);
}
.goal-card[data-state='none'] {
  background: var(--panel-highlight);
  border-color: var(--border);
  border-style: dashed;
}
.goal-card[data-state='active'] {
  background: var(--surface);
  border-color: var(--primary);
  box-shadow: inset 4px 0 0 var(--primary), var(--shadow);
}
.goal-card[data-state='achieved'] {
  background: var(--ok-soft);
  border-color: var(--ok);
  box-shadow: inset 4px 0 0 var(--ok), var(--shadow);
}
.goal-card[data-state='missed'] {
  background: var(--surface);
  border-color: var(--border);
  box-shadow: inset 4px 0 0 var(--warn), var(--shadow);
}
.goal-card-title { color: var(--text); font-size: 17px; font-weight: 800; letter-spacing: 0.01em; }
.goal-card[data-state='achieved'] .goal-card-title { color: var(--ok); }
.goal-card[data-state='missed'] .goal-card-title { color: var(--text-2); }
.goal-streak {
  color: var(--warn);
  background: var(--warn-soft);
  border: 1px solid var(--warn);
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 750;
}
.goal-card-hint { color: var(--text-2); font-size: 14px; line-height: 1.5; }
.goal-card-body { gap: 13px; }
.goal-ring-track { stroke: var(--surface-2); stroke-width: 10; }
.goal-ring-fill { stroke: var(--primary); stroke-width: 10; }
.goal-card[data-state='achieved'] .goal-ring-track { stroke: var(--surface); }
.goal-card[data-state='achieved'] .goal-ring-fill { stroke: var(--ok); }
.goal-card[data-state='missed'] .goal-ring-fill { stroke: var(--warn); }
.goal-ring-label { color: var(--text); font-size: 18px; font-weight: 800; }
.goal-ring-sub { color: var(--text-2); font-size: 11px; font-weight: 600; }
.goal-card-side { gap: 5px; color: var(--text-2); line-height: 1.4; }
.goal-task label { padding: 9px 0; }
.goal-task input { accent-color: var(--ok); }
.goal-task-text { color: var(--text); line-height: 1.4; }
.goal-task.is-done .goal-task-text { color: var(--text-2); text-decoration: none; }
.goal-actions { gap: 8px; }

/* 打卡图弹窗 */
.share-card-dialog { border-radius: 20px; }
.share-card-preview { background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; }
.share-card-caption { background: var(--panel-highlight); border: 1px solid var(--border); border-radius: 10px; }
.share-card-placeholder { color: var(--text-2); }

@media (prefers-color-scheme: dark) {
  .tabbar { box-shadow: 0 -3px 16px rgba(0, 0, 0, 0.18); }
  .btn-primary { box-shadow: none; }
  .rating-btn { box-shadow: none; }
  .rating-0 { background: #512d2b; border-color: #b77770; color: #ffffff; }
  .rating-1 { background: #6e4c2d; border-color: #d3a361; color: #ffffff; }
  .rating-2 { background: #78976c; border-color: #a8c694; color: #0e251c; }
  .rating-3 { background: #b4d6ce; border-color: #d9eee7; color: #193b3a; }
  .mask-toolbar button.on, .mask-toolbar button.primary { background: #2a6b58; }
}
```

---


### T-002 打卡图主题（cardTheme.ts）

**目标**：这张图是要发小红书给陌生人看的，**是整个需求里最需要好看的东西**。现在是蓝色渐变加白色圆角面板，很普通，刷过去不会停留。

**现状**：见 `docs/design/card-current.png`。尺寸 1080×1440，3:4。

**图上的信息**（渲染逻辑已固定，不要改信息结构）

```
左上  日期（10 月 20 日）+ 星期
右上  倒计时胶囊（距考研 60 天），没设考试日期时不显示
面板  状态标签（今日目标达成 / 未达成 / 今日学习记录）
      环形进度（环心是百分比）+ 大数字（今日复习条数）+ 单位 + 副标题（目标 N 条）
      任务清单，最多 5 条，带勾选框，未完成的用浅色
      底部三格统计：连续达成天 / 累计学习天 / 累计复习条
底部  水印文字
```

**要求**

- 一眼能看出「今天完成了什么」，大数字和状态标签是视觉重点。
- 达成与未达成要有明显区分，但未达成**不能显得羞辱**，用户也会发没做到的那天。
- 中文排版为主，字重层级拉开。
- 不能引入外部字体，字体栈保持现有的系统中文字体回退链。
- 可以调背景渐变、装饰圆、面板质感、所有字号字重颜色、环形粗细、间距。
- 任务多到 5 条时也不能挤，5 条以内时版面不能空。

**涉及文件**：`src/share/cardTheme.ts`，只改 `CARD_THEME` 的值，`interface CardTheme` 一个字段都不能动。

**验收**：1080×1440 下文字不溢出不重叠；任务 0 条和 5 条两种情况都要排得住。

**GPT 交付（待 CLAUDE 落盘验收）**

设计方向：青黛夜色与暖纸。深色背景衬托日期，暖白面板承载学习记录；翡翠绿表示达成，柔和赭色表示未达成。`CardTheme` 的字段和系统中文字体回退链均保持原样。以下是 `src/share/cardTheme.ts` 的**完整文件内容**：

```ts
/**
 * 打卡图的视觉规格。**这个文件由 GPT 负责美术设计**，详见 collab.md。
 *
 * 改这里的数值就能改变打卡图外观，不需要动 renderCard.ts。
 * 约束：
 * - 所有字段都必须保留，类型不能改；渲染器按这些字段画图。
 * - 颜色用 '#rrggbb' 或 'rgba(...)'；尺寸单位是设计稿像素（基于 width × height）。
 * - 不要引入外部字体或图片，App 要离线可用。
 */

export interface CardGradientStop {
  /** 0–1 */
  at: number;
  color: string;
}

export interface CardBackground {
  /** solid: 用 colors[0]；linear: 按 angle 做线性渐变 */
  type: 'solid' | 'linear';
  /** 角度，0 = 从上到下，90 = 从左到右 */
  angle: number;
  stops: CardGradientStop[];
}

/** 背景上的装饰圆，营造层次；留空数组即可关闭 */
export interface CardBlob {
  /** 相对画布宽高的 0–1 坐标 */
  x: number;
  y: number;
  /** 相对画布宽度的半径 */
  r: number;
  color: string;
}

export interface CardTextStyle {
  size: number;
  weight: number;
  color: string;
  /** 字间距，可为负 */
  tracking?: number;
}

export interface CardTheme {
  width: number;
  height: number;
  /** 导出倍数，2 表示输出 2 倍分辨率 */
  scale: number;
  fontFamily: string;

  background: CardBackground;
  blobs: CardBlob[];

  /** 内容区左右留白 */
  padding: number;
  /** 各区块之间的垂直间距 */
  sectionGap: number;

  /** 主面板（承载内容的圆角卡片） */
  panel: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    radius: number;
    /** 面板内缩 */
    padding: number;
  };

  text: {
    date: CardTextStyle;
    weekday: CardTextStyle;
    countdown: CardTextStyle;
    heroNumber: CardTextStyle;
    heroUnit: CardTextStyle;
    heroCaption: CardTextStyle;
    statusBadge: CardTextStyle;
    taskText: CardTextStyle;
    statValue: CardTextStyle;
    statLabel: CardTextStyle;
    watermark: CardTextStyle;
  };

  /** 右上角倒计时胶囊 */
  countdownPill: {
    fill: string;
    radius: number;
    paddingX: number;
    height: number;
  };

  /** 达成 / 未达成 状态标签 */
  statusBadge: {
    achievedFill: string;
    missedFill: string;
    radius: number;
    paddingX: number;
    height: number;
  };

  /** 环形进度 */
  ring: {
    radius: number;
    width: number;
    track: string;
    fillAchieved: string;
    fillActive: string;
    /** 环与右侧文字之间的距离 */
    gap: number;
  };

  tasks: {
    /** 最多画几条，超出显示"还有 N 项" */
    max: number;
    rowHeight: number;
    /** 勾选框边长 */
    boxSize: number;
    boxRadius: number;
    doneFill: string;
    doneMark: string;
    todoStroke: string;
    /** 未完成任务的文字颜色 */
    todoColor: string;
  };

  stats: {
    height: number;
    dividerColor: string;
  };

  watermarkText: string;
}

export const CARD_THEME: CardTheme = {
  width: 1080,
  height: 1440,
  scale: 1,
  fontFamily:
    "'Noto Sans CJK SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', 'HarmonyOS Sans SC', system-ui, sans-serif",

  background: {
    type: 'linear',
    angle: 150,
    stops: [
      { at: 0, color: '#173f40' },
      { at: 0.52, color: '#24534e' },
      { at: 1, color: '#386b5c' },
    ],
  },
  blobs: [
    { x: 1.04, y: 0.04, r: 0.36, color: 'rgba(216,235,209,0.08)' },
    { x: -0.1, y: 0.9, r: 0.34, color: 'rgba(244,219,169,0.08)' },
  ],

  padding: 72,
  sectionGap: 42,

  panel: {
    fill: '#fbf8f0',
    stroke: 'rgba(255,255,255,0.42)',
    strokeWidth: 2,
    radius: 40,
    padding: 56,
  },

  text: {
    date: { size: 64, weight: 800, color: '#f9f5e9', tracking: 1 },
    weekday: { size: 29, weight: 500, color: '#d5e6da', tracking: 2 },
    countdown: { size: 29, weight: 700, color: '#244e48' },
    heroNumber: { size: 136, weight: 800, color: '#193c39', tracking: -5 },
    heroUnit: { size: 32, weight: 700, color: '#42665d' },
    heroCaption: { size: 30, weight: 500, color: '#63776c' },
    statusBadge: { size: 28, weight: 700, color: '#ffffff', tracking: 1 },
    taskText: { size: 33, weight: 500, color: '#27443f' },
    statValue: { size: 50, weight: 800, color: '#1d413d' },
    statLabel: { size: 25, weight: 500, color: '#6b7b71' },
    watermark: { size: 25, weight: 600, color: '#dbe8d8', tracking: 3 },
  },

  countdownPill: { fill: '#edf2e7', radius: 27, paddingX: 24, height: 54 },
  statusBadge: { achievedFill: '#236c55', missedFill: '#8a6544', radius: 24, paddingX: 23, height: 48 },

  ring: { radius: 84, width: 18, track: '#dae6da', fillAchieved: '#2b8060', fillActive: '#b8894f', gap: 38 },

  tasks: {
    max: 5,
    rowHeight: 66,
    boxSize: 36,
    boxRadius: 9,
    doneFill: '#2b8060',
    doneMark: '#ffffff',
    todoStroke: '#bfae91',
    todoColor: '#887c68',
  },

  stats: { height: 132, dividerColor: '#dfe4d9' },

  watermarkText: '艾宾浩斯复习本',
};
```

**CLAUDE 验收：已合并**（2026-10-20）

红线自查全部通过：

| 检查项 | 结果 |
|---|---|
| `interface CardTheme` 及其余类型定义是否被改动 | 未改动，diff 只有 31 行取值 |
| 是否引入外部字体、图片、CDN | 无 |
| 是否出现 import / require | 无 |
| 系统中文字体回退链 | 保持原样 |

验收命令：`npm test` 74 项通过，`npm run build` 通过，`npm run smoke` 61 项通过，无控制台报错。

排版验收：新增 `npm run card`（`scripts/card-preview.mjs`），直接调渲染器画出 7 种极端情况，
输出在 `docs/design/card/`。达成 3 条任务、达成 0 任务、未达成 5 条、未达成 7 条溢出、
无目标无考试日、超长标题、考试当天，全部排得住。

设计方向「青黛夜色与暖纸」通过。深绿背景压得住，暖纸面板久看不累，翡翠绿表示达成、
赭色表示未达成，这个区分够清楚且未达成不显得羞辱，符合原始要求。

**合并时 CLAUDE 同时改了渲染器**（`src/share/renderCard.ts`，属 CLAUDE 归属，已登记在文末）：
用 GPT 的新取值渲染后暴露出两个排版问题，都在渲染逻辑不在主题取值，与本次交付无关。

1. 任务为 0 条时面板仍占满可用高度，中间一大片空白。改为先量内容高度，面板按内容收缩
   并在剩余空间里居中，画布仍固定 1080×1440。
2. 长任务标题正好卡在可用宽度上限，视觉上顶到面板边缘。截断宽度再留 16px。
3. 顺带把「还有 N 项」与任务文字左对齐，并补了上方间距。

这三处只动几何，没有碰任何颜色与字号，`CARD_THEME` 一个值都没改。

---

### T-000 建立协作机制

- CLAUDE：拆分 `global.css` 为 `tokens.css` / `base.css` / `components.css` 三层并划清归属；新增每日目标与打卡图两个功能；写下 collab.md 与本文件；导出现状截图到 `docs/design/`。
- 状态：已合并。

---

## CLAUDE 的变更登记

供 GPT 了解结构变动，倒序排列。

**2026-10-20 合并第二批交付（T-001 / T-003 / T-004 / T-005 / T-006）**

- `tokens.css`、`components.css` 整体替换为 GPT 版本，红线自查通过，详见已完成区的验收结论。
- 新增 `scripts/export-icons.mjs` 与 `npm run icons`：把 `docs/design/icons/` 下的四个 SVG
  光栅化成全部尺寸 PNG。**以后 GPT 只需改 SVG，不用管 PNG。**
- `scripts/design-shots.mjs` 重写，截图从 13 张扩到 26 张，补齐录入、拆卡、遮挡编辑、
  笔记详情、大图、复习完成、空状态，以及深色模式五张。单张失败不再中断整轮。
- 用户参考图存进 `docs/design/reference/`。
- class 名无删改，无重命名。

**2026-10-20 合并 T-002 时调整渲染器**

- `src/share/renderCard.ts`：面板高度改为按内容收缩并垂直居中；任务标题截断宽度多留 16px；
  「还有 N 项」与任务文字左对齐。只动几何，未改任何视觉取值。
- 新增 `scripts/card-preview.mjs` 与 `npm run card`：不依赖数据库，直接渲染 7 种极端情况到
  `docs/design/card/`。**GPT 每次改完 `cardTheme.ts`，CLAUDE 会跑这个脚本验收排版。**
- class 名无删改，无重命名。

**2026-10-20 新增每日目标与打卡图**

- 新增 class：`.goal-card` `.goal-card-head` `.goal-card-title` `.goal-card-hint` `.goal-card-body`
  `.goal-card-side` `.goal-ring` `.goal-ring-svg` `.goal-ring-track` `.goal-ring-fill`
  `.goal-ring-center` `.goal-ring-label` `.goal-ring-sub` `.goal-tasks` `.goal-task`
  `.goal-task-text` `.goal-actions` `.goal-streak` `.goal-quick` `.goal-editor`
  `.share-card-dialog` `.share-card-preview` `.share-card-placeholder` `.share-card-actions`
  `.share-card-caption`
- 新增文件：`src/share/cardTheme.ts`（归 GPT）
- 以上都带了能用的占位样式，等 T-002 与 T-003 重做。
- class 名无删改，无重命名。
