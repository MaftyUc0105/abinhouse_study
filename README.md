# 艾宾浩斯复习本

面向考研备考的间隔重复记忆工具。粘贴笔记或拍照录入，按艾宾浩斯遗忘曲线安排复习，复习时四档自评，评分记录影响后续间隔并给出"重点 / 注意 / 稳固"强度提示。

- 安卓 App（APK）与网页版（PWA）两种形式，离线可用；App 支持每日复习通知和直接分享备份
- 数据存在本机浏览器（IndexedDB），可自动同步到自己的 GitHub 私有仓库，也支持 ZIP 备份导出 / 导入
- 一条笔记 = 标题 + 可选 Markdown 文字 + 多张照片；笔记可拆分为问答卡片各自排期
- 照片可画遮挡块，复习时先遮住关键词自测，再逐块揭开
- 考研倒计时：复习间隔不会越过考试日，越临考越密

## 本地运行

```powershell
npm install
npm run dev        # 已带 --host，手机连同一 WiFi 后用 Chrome 打开终端里显示的 Network 地址
npm test           # 单元测试
npm run smoke      # 端到端冒烟测试（需先 npm run dev，用本机 Edge 无头运行，使用临时浏览器配置）
npm run build      # 产物在 dist/
```

局域网 `http://` 地址可以用，但浏览器不允许安装为 PWA（需要 HTTPS）。想在手机上"添加到主屏幕"，请使用下面的线上地址。

## 部署到 GitHub Pages

线上地址：https://maftyuc0105.github.io/abinhouse_study/

改完代码后更新线上版本：

```powershell
git add -A; git commit -m "说明"; git push
npm run deploy     # 测试 → 按仓库名构建 → 推送 dist 到 gh-pages 分支
```

仓库 Settings → Pages 的来源是 `gh-pages` 分支根目录。手机上已安装的应用下次打开时会自动更新。

## 安卓 App（推荐）

下载：https://github.com/MaftyUc0105/abinhouse_study/releases/latest ，手机浏览器打开，下载 `abinhouse-版本号.apk` 后点开安装。

- 安装时澎湃 OS / MIUI 会提示"未知来源"或"安全检测"，选择继续安装。
- **从网页版迁移数据**：先在网页版 设置 → 保存备份到手机，再在 App 里 设置 → 导入备份，选"覆盖本机"。
- **每日复习提醒**：App 设置 → 每日复习提醒，打开并选时间。到点没收到时，手机设置 → 应用设置 → 复习本，打开"自启动"，省电策略选"无限制"。
- **备份**：App 里可以直接"分享到微信 / 网盘"，或"保存到手机"（文件管理 → 文档 → 复习本备份）。
- **更新**：App 每天自动检查一次，或在 设置 → 应用更新 手动检查，下载新版 APK 覆盖安装，数据保留。
- 返回键：先关闭大图、遮挡编辑、对话框，再返回上一页，在首页时退到后台。

### 打包 APK（开发者）

开发环境在 D 盘：JDK 21 `D:\dev\jdk21`，Android SDK `D:\dev\android-sdk`，Gradle 缓存 `D:\dev\gradle-home`（`init.d/mirrors.gradle` 让 Maven 中央仓库走阿里云镜像）。

```powershell
# 先把 package.json 的 version 改大（如 0.2.1），再：
npm run apk                  # 测试 → 构建 → 同步 → 签名打包，输出 release/abinhouse-版本号.apk
npm run apk -- --publish     # 同时发布 GitHub Release，App 内"检查更新"会读到
```

**签名密钥必须备份**：`D:\dev\keys\abinhouse-release.jks` 和 `D:\dev\keys\keystore.properties`（含密码）。丢失后新版本无法覆盖安装，只能卸载重装（数据需先备份）。建议复制到 U 盘或网盘加密保存。`android/keystore.properties` 已被 git 忽略。

## 网页版安装

1. 安卓 Chrome 打开上面的线上地址。
2. 菜单 → "添加到主屏幕"（或页面底部弹出的安装提示）。
3. 之后从桌面图标打开即是全屏应用，图标角标显示今日待复习数。

网页版无法在后台定时弹通知，需要提醒请用安卓 App。

## 复习算法

- 阶梯默认 `1, 2, 4, 7, 15, 30, 60` 天，可在设置里改。
- 新条目次日到期。
- 忘了：回到第 0 档，次日再来（当次会话末尾会再看一遍）。
- 模糊：档位不变，间隔 × 0.7。
- 记得：进一档。很熟：跳两档。
- 超过阶梯顶端后间隔按乘数（默认 2）翻倍，封顶 180 天。
- 设置了考研日期时，离考 N 天的间隔最长为 N/2 天。
- 强度标签看最近 3 次评分：忘了 ≥ 2 次或弱评 ≥ 3 次 → 重点；有弱评 → 注意；3 次全好 → 稳固。
- 今日队列：逾期越久越靠前，同逾期按强度，新条目排最后。

## 备份

**保存备份到手机（不需要任何账号）**：设置 → 备份 → "保存备份到手机"，生成 `abinhouse_backup_YYYY-MM-DD.zip` 并下载到手机"下载"文件夹（含 `backup.json` 和 `images/*.jpg`）。超过 7 天没有备份也没有同步时，首页会提醒。

- 发到微信或网盘：点通知栏的下载完成通知，或在文件管理 → 下载里长按文件选"分享"。部分浏览器不允许网页直接分享文件，所以应用只负责保存。
- 没有开始下载时，点按钮下方的"没有开始下载？点这里"。
- 恢复：在微信里打开备份文件并保存到手机，再到 设置 → 导入备份 选择它。支持 .zip，也兼容之前的 .txt 备份。
- 导入时"合并"按修改时间取新，"覆盖"先清空本机再导入。

## 云端同步（GitHub 私有仓库）

数据仓库：https://github.com/MaftyUc0105/abinhouse_study_data （私有）

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token。
2. 有效期选 1 年；Repository access 选 **Only select repositories**，只勾 `abinhouse_study_data`。
3. Permissions → Repository permissions → **Contents: Read and write**，其余不动，生成并复制。
4. 应用 → 设置 → 云端同步，仓库填 `MaftyUc0105/abinhouse_study_data`，粘贴令牌，点"连接并同步"。
5. 每台设备都这样设置一次。之后打开应用、改动 20 秒后、切到后台时会自动同步。

说明：

- 令牌只保存在该设备的浏览器里，不进入同步数据和备份文件。手机丢失时到 GitHub 撤销令牌即可。
- 仓库里是 `data.json`（笔记、卡片、复习记录、设置）和 `images/*.jpg`。多台设备同时改动时按修改时间合并，删除会同步到其他设备。
- GitHub 建议单个仓库不超过 1 GB，按每张照片约 300 KB 估算，大约能放 3000 张。
- 设置页"清空全部数据"只清本机，之后再同步会从云端恢复。

## 复习小功能

- **遮挡自测**：录入或编辑时点照片缩略图，拖动画框遮住关键词。复习时遮挡块先显示，点一块揭开一块，"显示内容"揭开全部。笔记详情页也可以进入"遮挡自测"。
- **按科目复习**：今日页点科目标签，再点"开始复习"。
- **撤销**：复习页右上角"撤销"可以撤回上一次评分。
- **电脑快捷键**：空格显示内容，1–4 评分，Z 撤销，L 稍后。
- **到期日错开**：间隔 4 天以上时到期日前后浮动最多 3 天，避免某天复习量突然堆积，可在设置里关闭。
