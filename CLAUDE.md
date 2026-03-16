# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **uTools plugin** that converts Java `toString()` output strings into JSON format. uTools is an Electron-based productivity launcher (Chinese ecosystem). The plugin is triggered by keyword "Java转JSON" and accepts text input.

## Build Commands

```bash
npm install              # Install dependencies (uses npmmirror.com registry via .npmrc)
npm run dev              # Watch mode development build (webpack -w --mode development)
npm run build            # Production build (webpack --mode production)
```

Output goes to `dist/`. No test framework or linter is configured.

## Architecture

**Webpack dual-entry build** (`webpack.config.js`):
- `electron-preload` target: compiles `bridge/preload.js` → `dist/preload.js` (Node.js/Electron APIs)
- `web` target: compiles `src/index.js` → `dist/index.js` (React UI), copies `public/` to `dist/`

**Key files:**
- `public/plugin.json` — uTools plugin manifest (feature code: `javaToJson`, entry: `index.html`, preload: `preload.js`)
- `src/App.js` — Contains both the UI (React + MUI) and the core `parseJavaToString()` parser function
- `src/ErrorBoundary.js` — Global error boundary with toast-style error display
- `bridge/preload.js` — Electron preload script (currently stub with usage comments)

**Core parser** (`parseJavaToString` in `src/App.js`):
- Parses `ClassName{key=value, ...}` format recursively (nested objects, arrays, strings, primitives)
- Handles `ClassName@hashcode` format
- Uses character-by-character parsing with bracket/brace depth tracking

## uTools Plugin Conventions

- Access uTools API via `window.utools` (e.g., `onPluginEnter`, `onPluginOut`, `copyText`)
- Access Node.js services via `window.services` (exposed from preload script)
- Never expose raw Node.js modules (`fs`, `child_process`) directly to the renderer — wrap them as functions in preload
- UI language is Chinese (zh-CN)

## Tech Stack

React 19, MUI 7, Webpack 5, Babel (targets Chrome 108 / Electron 22), Less for styles

---

## uTools Developer Documentation Reference

> Source: https://www.u-tools.cn/docs/developer/basic/getting-started.html

### Plugin Directory Structure

最小结构只需 `plugin.json` + `logo` + `main`(或 `preload`)。完整结构示例：

```
/{plugin}
├── plugin.json
├── preload.js
├── index.html
├── index.js
├── index.css
└── logo.png
```

- 使用 webpack/vite 等工具时，编译输出到 `dist/`，**打包 dist 目录**而非项目根目录
- 前端依赖安装在项目根目录，编译后输出到 dist
- Node.js 第三方依赖必须与 `preload.js` 同级，**不可编译/混淆**，源码必须可读

### plugin.json Core Configuration

```json
{
  "main": "index.html",        // 必填，入口 HTML（相对路径）
  "logo": "logo.png",          // 必填，插件 logo（相对路径）
  "preload": "preload.js",     // 可选，预加载脚本（相对路径）
  "pluginSetting": {
    "single": true,            // 单例模式，默认 true
    "height": 544              // 初始高度，可通过 setExpendHeight 动态修改
  },
  "features": [...]            // 必填，至少一个 feature
}
```

#### feature 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | `string` | 是 | 唯一标识，进入插件时传入区分功能 |
| `explain` | `string` | 否 | 功能描述 |
| `icon` | `string` | 否 | 功能图标（.png/.jpg/.svg） |
| `mainPush` | `boolean` | 否 | 是否推送内容到搜索框 |
| `mainHide` | `boolean` | 否 | 触发时不主动显示搜索框 |
| `cmds` | `Array<string\|object>` | 是 | 指令集（功能指令 + 匹配指令） |

#### 功能指令（Functional Commands）

直接搜索打开的字符串指令，中文指令自动支持拼音搜索：

```json
{ "cmds": ["测试", "hello"] }
```

#### 匹配指令（Matching Commands）

**regex** — 正则匹配文本：

```json
{
  "type": "regex",
  "label": "显示名",
  "match": "/^https?:\\/\\//i",
  "minLength": 1,
  "maxLength": 1000
}
```

**over** — 匹配任意文本：

```json
{
  "type": "over",
  "label": "显示名",
  "exclude": "/\\n/",
  "minLength": 1,
  "maxLength": 500
}
```

**img** — 匹配图片：

```json
{ "type": "img", "label": "OCR 文字识别" }
```

**files** — 匹配文件/文件夹：

```json
{
  "type": "files",
  "label": "图片处理",
  "fileType": "file",           // "file" | "directory"
  "extensions": ["png", "jpg"],  // 与 match 互斥
  "match": "/\\.png$/i",
  "minLength": 1,
  "maxLength": 100
}
```

**window** — 匹配当前活动窗口：

```json
{
  "type": "window",
  "label": "窗口操作",
  "match": {
    "app": ["chrome.exe", "Safari.app"],
    "title": "/GitHub/",
    "class": ["xxx"]              // 仅 Windows
  }
}
```

### Preload Script

preload 脚本独立于前端项目，遵循 CommonJS，可访问 Node.js API 和 Electron renderer API。

```js
// preload.js
const fs = require('node:fs')
const path = require('node:path')
const { clipboard } = require('electron')

window.services = {
  readFile: (p) => fs.readFileSync(p, 'utf-8'),
  getDir: (p) => path.dirname(p),
}
```

前端通过 `window.services.xxx()` 调用。第三方模块需与 preload.js 同级，源码不可混淆。

---

### Events API

```ts
// 进入插件
utools.onPluginEnter(({ code, type, payload, from, option }) => void)
// type: "text" | "img" | "file" | "regex" | "over" | "window"
// from: "main" | "panel" | "hotkey" | "reirect"
// payload: string | MatchFile[] | MatchWindow

// 退出插件
utools.onPluginOut((isKill: boolean) => void)
// isKill=true 进程结束，false 隐藏到后台

// 推送内容到搜索框（需 mainPush=true）
utools.onMainPush(
  (action: MainPushAction) => MainPushResult[],
  (action: PluginEnterAction) => boolean | undefined
)

// 插件分离为独立窗口
utools.onPluginDetach(() => void)

// 云端数据同步到本设备
utools.onDbPull((docs: DbDoc[]) => void)
```

**MatchFile**: `{ isFile, isDirectory, name, path }`
**MatchWindow**: `{ id, class, title, x, y, width, height, appPath, pid, app }`
**MainPushResult**: `{ icon, title, text }`

### Window API

```ts
utools.hideMainWindow(isRestorePreWindow?: boolean): boolean
utools.showMainWindow(): boolean
utools.setExpendHeight(height: number): boolean

// 子输入框（主搜索栏变为插件子输入框）
utools.setSubInput(onChange: ({text}) => void, placeholder?: string, isFocus?: boolean): boolean
utools.removeSubInput(): boolean
utools.setSubInputValue(text: string): boolean
utools.subInputFocus(): boolean
utools.subInputBlur(): boolean
utools.subInputSelect(): boolean

utools.outPlugin(isKill?: boolean): boolean

// 跳转到其他插件
utools.redirect(label: string | [pluginName, cmdName], payload?: any): boolean

// 原生对话框
utools.showOpenDialog(options): string[] | undefined
utools.showSaveDialog(options): string | undefined

// 页内搜索
utools.findInPage(text: string, options?): void
utools.stopFindInPage(action: "clearSelection" | "keepSelection" | "activateSelection"): void

// 拖拽文件
utools.startDrag(filePath: string | string[]): void

// 创建独立窗口
utools.createBrowserWindow(url: string, options: BrowserWindowOptions, callback?: Function): BrowserWindow
// 独立窗口 → 主窗口: utools.sendToParent(channel, ...args)
// 主窗口 → 独立窗口: win.webContents.send(channel, data)
// 接收方均用: ipcRenderer.on(channel, (event, data) => {})

utools.sendToParent(channel: string, ...args: any[]): void
utools.getWindowType(): "main" | "detach" | "browser"
utools.isDarkColors(): boolean
```

### Copy API

```ts
utools.copyText(text: string): boolean
utools.copyFile(filePath: string | string[]): boolean
utools.copyImage(image: string | Uint8Array): boolean  // 路径、base64、Buffer
utools.getCopyedFiles(): CopiedFile[]
// CopiedFile: { path, isDiractory, isFile, name }
```

### Input API（隐藏主窗口并粘贴/输入）

```ts
utools.hideMainWindowPasteText(text: string): boolean
utools.hideMainWindowPasteImage(image: string | Uint8Array): boolean
utools.hideMainWindowPasteFile(filePath: string | string[]): boolean
utools.hideMainWindowTypeString(text: string): boolean  // 模拟输入法打字
```

### System API

```ts
utools.showNotification(body: string, clickFeatureCode?: string): void
utools.shellOpenPath(fullPath: string): void
utools.shellTrashItem(fullPath: string): void
utools.shellShowItemInFolder(fullPath: string): void
utools.shellOpenExternal(url: string): void
utools.shellBeep(): void
utools.getNativeId(): string          // 设备唯一标识
utools.getAppName(): string
utools.getAppVersion(): string
utools.getPath(name): string
// name: "home" | "appData" | "userData" | "temp" | "exe" | "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | "logs"
utools.getFileIcon(filePath: string): string  // 返回 base64 Data URL
utools.readCurrentFolderPath(): Promise<string>   // 不支持 Linux
utools.readCurrentBrowserUrl(): Promise<string>    // 不支持 Linux
utools.isDev(): boolean
utools.isMacOS(): boolean
utools.isWindows(): boolean
utools.isLinux(): boolean
```

### Screen API

```ts
utools.screenColorPick(cb: ({hex, rgb}) => void): void
utools.screenCapture(cb: (base64Image) => void): void
utools.getPrimaryDisplay(): Display
utools.getAllDisplays(): Display[]
utools.getCursorScreenPoint(): {x, y}
utools.getDisplayNearestPoint({x, y}): Display
utools.getDisplayMatching({x, y, width, height}): Display
utools.screenToDipPoint({x, y}): {x, y}
utools.dipToScreenPoint({x, y}): {x, y}
utools.screenToDipRect(rect): rect
utools.dipToScreenRect(rect): rect
utools.desktopCaptureSources(options): Promise<DesktopCaptureSource[]>
```

### User API

```ts
utools.getUser(): { avatar, nickname, type: "member" | "user" } | null
utools.fetchUserServerTemporaryToken(): Promise<{ token, expired_at }>
```

### Database API (`utools.db` / `utools.db.promises`)

本地 NoSQL 数据库，文档限制 1MB，支持云同步。所有方法均有同步和异步版本。

```ts
// 创建/更新文档（更新需带 _rev）
utools.db.put(doc: { _id, _rev?, ...data }): { id, rev?, ok?, error?, message? }

// 获取文档
utools.db.get(id: string): DbDoc | null

// 删除文档
utools.db.remove(doc | id): DbResult

// 批量创建/更新
utools.db.bulkDocs(docs: DbDoc[]): DbResult[]

// 查询文档（前缀/ID数组/全部）
utools.db.allDocs(idStartsWith?: string): DbDoc[]
utools.db.allDocs(ids: string[]): DbDoc[]

// 附件操作（附件最大 10MB）
utools.db.postAttachment(id, attachment: Buffer | Uint8Array, mimeType): DbResult
utools.db.getAttachment(id): Uint8Array
utools.db.getAttachmentType(id): string

// 云同步状态
utools.db.replicateStateFromCloud(): null | 0 | 1
// null=未启用, 0=同步完成, 1=同步中
```

**dbStorage**（简单 key-value）：

```ts
utools.dbStorage.setItem(key, value): void
utools.dbStorage.getItem(key): any
utools.dbStorage.removeItem(key): void
```

**dbCryptoStorage**（加密 key-value）：

```ts
utools.dbCryptoStorage.setItem(key, value): void
utools.dbCryptoStorage.getItem(key): any
utools.dbCryptoStorage.removeItem(key): void
```

### Dynamic Features API（动态指令）

运行时添加/移除无法预定义在 plugin.json 中的功能。

```ts
utools.getFeatures(codes?: string[]): Feature[]
utools.setFeature(feature: Feature): void
utools.removeFeature(code: string): boolean
utools.redirectHotKeySetting(cmdLabel: string, autocopy?: boolean): void
utools.redirectAiModelsSetting(): void
```

### Simulate API（模拟按键/鼠标）

```ts
utools.simulateKeyboardTap(key: string, ...modifiers: string[]): void
utools.simulateMouseMove(x: number, y: number): void
utools.simulateMouseClick(x: number, y: number): void
utools.simulateMouseDoubleClick(x: number, y: number): void
utools.simulateMouseRightClick(x: number, y: number): void
```

### Payment API

```ts
utools.isPurchasedUser(): boolean | string
// false=未付费, true=永久授权, "yyyy-mm-dd hh:mm:ss"=到期时间

utools.openPurchase(options: { goodsId, outOrderId?, attach? }, callback?: () => void): void
// 软件付费模型（按时间授权）

utools.openPayment(options: { goodsId, outOrderId?, attach? }, callback?: () => void): void
// 服务付费模型（按次/按量）

utools.fetchUserPayments(): Promise<Payment[]>
// Payment: { order_id, out_order_id, open_id, pay_fee(分), body, attach, goods_id, paid_at, created_at }
```

### ubrowser API（可编程自动化浏览器）

链式调用，所有方法返回 `UBrowser` 实例：

```ts
utools.ubrowser
  .goto(url, headers?, timeout?)
  .useragent(ua)
  .viewport(width, height)
  .hide() / .show()
  .css(cssString)
  .evaluate(func, params?)           // 在网页中执行 JS，返回值在 run() 结果中
  .press(key, ...modifiers)
  .click(selector | x, y, mouseButton?)
  .mousedown / .mouseup / .dblclick / .hover  // 同 click 参数
  .file(selector, payload)            // input[type=file] 上传
  .drop(selector | x, y, payload)     // 拖拽上传
  .input(text) / .input(selector, text)
  .value(selector, value)             // 直接设置 input/textarea/select 值
  .check(selector, checked)           // checkbox/radio
  .focus(selector)
  .scroll(selector, options?) / .scroll(y) / .scroll(x, y)
  .download(url, savePath?)
  .paste(text)                        // 粘贴文本或 base64 图片
  .screenshot(target?, savePath?)     // PNG 截图
  .markdown(selector?)                // 网页转 Markdown
  .pdf(options, savePath?)
  .device({ userAgent, size: { width, height } })
  .wait(ms) / .wait(selector, timeout?) / .wait(func, timeout?, ...params)
  .when(selector, result?) / .when(func, ...params)  // 条件分支
  .end()                              // 结束 when 块
  .cookies(name? | filter?) / .setCookies(...) / .removeCookies(name) / .clearCookies(url?)
  .devTools(mode?)
  .run(ubrowserId?, options?): Promise<[...results, UBrowserInstance]>
```

选择器支持 CSS/XPath，`>>` 用于 iframe 嵌套。

```ts
utools.getIdleUBrowsers(): UBrowserInstance[]
utools.setUBrowserProxy(config): boolean
utools.clearUBrowserCache(): boolean
```

### AI API

```ts
// 流式调用
utools.ai(option: AiOption, streamCallback: (chunk: Message) => void): PromiseLike<void>
// 非流式调用
utools.ai(option: AiOption): PromiseLike<Message>

// AiOption: { model?, messages: Message[], tools?: Tool[] }
// Message: { role: "system"|"user"|"assistant", content?, reasoning_content? }
// Tool: { type: "function", function: { name, description, parameters: { type: "object", properties }, required? } }
// PromiseLike 扩展了 abort() 方法

// Function Calling: 函数必须挂到 window 对象上

// 获取所有可用模型
utools.allAiModels(): Promise<AiModel[]>
// AiModel: { id, label, description, icon, cost }
```

### Sharp API（内置 Sharp v0.34.5 图像处理）

```ts
utools.sharp(input?, options?): Sharp
// input: Buffer | Uint8Array | string(路径) | { text } | { create } | Array
// 链式操作: .resize() .rotate() .flip() .flop() .extract() .extend() .trim()
//          .grayscale() .negate() .tint() .normalize() .gamma() .threshold()
//          .blur() .sharpen() .median() .flatten() .composite()
//          .jpeg() .png() .webp() .tiff()
//          .toBuffer() .toFile(path) .metadata() .clone()
```

### FFmpeg API（内置 FFmpeg v7.1）

首次调用时 uTools 自动引导用户下载 FFmpeg。

```ts
utools.runFFmpeg(args: string[], onProgress?: (progress: RunProgress) => void): PromiseLike<void>
// PromiseLike 扩展: kill()=强制终止, quit()=优雅退出
// RunProgress: { bitrate, fps, frame, percent?, q, size, speed, time }
```
