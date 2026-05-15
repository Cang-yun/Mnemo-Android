# Mnemo Android

日程/笔记一体的长期任务规划软件，基于艾宾浩斯遗忘曲线。Capacitor + React + TypeScript。

Windows端见：[Mnemo](https://github.com/Cang-yun/Mnemo)

## 功能

- **计划管理** — 创建学习计划或事项计划，计划中可添加知识点或事项。支持自定义起始日期、天数和复习间隔。内置经典艾宾浩斯（1/2/4/7/15/30 天）、密集冲刺（连续 6 天）、每日任务三种模板。
- **自动排程** — 添加知识点时按复习间隔自动生成排程，逾期任务顺延至今天，不丢失。
- **今日任务** — 勾选完成，反馈记忆状态（记住/模糊/遗忘），一键延期或跳过。模糊和遗忘会自动生成补救复习。
- **月任务** — 按日期浏览所有计划的新增与复习安排，默认定位到今天，支持快速回到今天。
- **计划视图** — 查看每个计划的日期安排、知识点和事项，适配移动端纵向浏览。
- **笔记系统** — 内置 Markdown 编辑器，支持 GFM 语法（标题、粗斜体、表格、代码块、任务列表等），可导出为 Markdown 文件。
- **标签筛选** — 笔记页按标签组织和搜索知识点/事项。
- **薄弱追踪** — 遗忘或模糊的知识点会自动标记为“薄弱”，进度页集中查看和复习。
- **外观主题** — 霜灰、墨蓝、炭墨、茶白四套内置配色，支持自定义纸张、文字和强调色。
- **云存档** — 支持 WebDAV 协议（坚果云）手动备份/恢复，上传或恢复前展示差异对比。
- **数据备份** — JSON 格式导入/导出，包含计划、知识点、笔记和完成状态。数据结构与桌面端保持兼容。

## 移动端说明

- Android 端针对小屏幕重新适配了今日任务、月任务、计划、笔记、进度和设置页面。
- 不包含桌面端的窗口控制、系统托盘和开机自启。
- 本地数据保存在应用私有目录；备份和笔记导出通过系统分享完成。
- 云存档路径与桌面端一致，可与桌面端使用同一份 WebDAV 存档。

## 环境

```bash
Node.js >= 22
Android Studio / Android SDK
```

## 开发

```bash
npm install
npm run dev            # 浏览器开发预览
npm run android:sync   # 构建 Web 资源并同步到 Android 工程
npm test               # 单元测试
```

## 打包

```bash
npm run build:web
npx cap sync android
cd android
./gradlew assembleDebug
```

调试包输出位置：

```bash
android/app/build/outputs/apk/debug/app-debug.apk
```

## 技术栈

Capacitor · Android · React 19 · Vite · TypeScript · TipTap · Vitest

## 许可

[MIT](LICENSE) · 第三方依赖见 [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md)
