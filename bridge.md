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
当前视觉是开发期的默认样式，没有经过设计，**这正是要你改的**。

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

---

### T-002 打卡图主题（cardTheme.ts）★ 优先做这个

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

---

### T-004 复习页与评分按钮

**目标**：复习是每天停留最久的页面，现在四个评分按钮是四块纯色方块，廉价。

**现状**：见 `docs/design/review.png`。

**结构**：底部固定 `.review-actions` 里是 `.rating-bar`，内含四个 `.rating-btn`，分别带 `.rating-0`（忘了）到 `.rating-3`（很熟）。按钮内有主文字和一行小字（显示下次间隔天数）。顶部是 `.review-progress` 进度条，内容区是 `.review-title`。

**要求**：四档要靠颜色与形态区分，手指误触代价高，按钮高度不低于 56px。`.review-actions` 的 `position:fixed` 和安全区内边距不要动。

**涉及文件**：`src/styles/components.css`

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

---

### T-006 其余组件外观

在 T-001 定下变量后，统一梳理按钮、输入框、chip、badge、底部导航、今日 banner、统计页、弹窗的外观。
与 T-003、T-004 在同一个 `components.css` 里，建议等前面几项定稿后一次性交付，避免互相覆盖。

---

## 验收中

（空）

---

## 已完成

### T-000 建立协作机制

- CLAUDE：拆分 `global.css` 为 `tokens.css` / `base.css` / `components.css` 三层并划清归属；新增每日目标与打卡图两个功能；写下 collab.md 与本文件；导出现状截图到 `docs/design/`。
- 状态：已合并。

---

## CLAUDE 的变更登记

供 GPT 了解结构变动，倒序排列。

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
