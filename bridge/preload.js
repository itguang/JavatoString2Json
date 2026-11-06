/*
preload.js 说明
- 运行于 Electron 预加载环境（preload），可使用：Node.js API、Electron 渲染进程 API、Web API、第三方 Node.js 库。
- 通过 window.services 向前端 UI 暴露封装后的服务接口。

约束：
- 禁止将 Node.js 原生模块（如 fs、child_process、require 等）直接暴露给前端。
- 仅允许暴露函数形式的受控能力。
*/
const { clipboard } = require('electron')

window.services = {
  // navigator.clipboard.readText 在插件里可能因为焦点或权限读不到，用 Electron 的剪贴板更可靠
  readClipboardText: () => clipboard.readText()
}
