# Java转JSON

<div align="center">

一款轻量级的 uTools 插件，可将 Java 对象的 `toString()` 输出字符串快速转换为 JSON 格式

[![uTools](https://img.shields.io/badge/uTools-插件-green)](https://u.tools/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![MUI](https://img.shields.io/badge/MUI-7.3-purple)](https://mui.com/)
[![Webpack](https://img.shields.io/badge/Webpack-5.102-orange)](https://webpack.js.org/)

</div>

## 功能特性

- 支持 Java 对象 `toString` 字符串解析
- 智能识别嵌套对象和数组
- 支持数组格式 `[...]`
- 支持对象格式 `ClassName{key=value, ...}`
- 一键复制 JSON 结果
- 清爽的深色/浅色主题界面
- 实时转换反馈

## 安装方法

### 方式一：通过 uTools 插件市场安装（推荐）

1. 打开 uTools
2. 进入插件市场
3. 搜索 "Java转JSON"
4. 点击安装

### 方式二：本地安装

1. 克隆本仓库：
   ```bash
   git clone https://github.com/yourusername/JavatoString2Json.git
   cd JavatoString2Json
   ```

2. 构建项目：
   ```bash
   npm install
   npm run build
   ```

3. 在 uTools 中安装本地插件：
   - 打开 uTools 设置 -> 插件 -> 开发模式
   - 点击 "安装本地插件"，选择项目根目录

## 使用方法

### 快速上手

1. 按 `Alt + Space`（或配置的 uTools 快捷键）打开 uTools
2. 输入 `Java转JSON` 或 `javaToJson`
3. 将 Java 对象的 `toString` 字符串粘贴到输入框
4. 自动转换为 JSON 格式
5. 复制结果

### 支持的格式示例

#### 数组格式
```java
[Request(vehicle=VehicleRequest(vehicleId=VE-INFLFIOWQX6, brand=英菲尼迪), channel=Android)]
```

#### 对象格式
```java
User{id=123, name="张三", age=25, address=Address{city="北京", district="朝阳区"}}
```

#### 基本类型
```
id=123, name="test", active=true, score=98.5
```

#### 嵌套支持
```java
Order{id=ORD001, items=[Item{name="商品A", price=100}, Item{name="商品B", price=200}]}
```

### 插件配置

插件入口：`uTools -> Java转JSON`

| 配置项 | 说明 |
|--------|------|
| 关键字 | `Java转JSON` |
| 输入类型 | 文本输入 |
| 匹配模式 | 模糊匹配 |

## 技术栈

- **前端框架**：React 19.2
- **UI 组件库**：MUI（Material-UI）7.3
- **构建工具**：Webpack 5.102
- **样式方案**：Emotion + Less
- **JavaScript 运行环境**：Electron（uTools 内置）

## 开发说明

### 项目结构

```
JavatoString2Json/
├── public/              # 静态资源
│   ├── plugin.json     # uTools 插件配置
│   ├── logo.svg        # 插件图标
│   └── index.html      # 入口 HTML
├── src/
│   ├── App.js          # 主应用组件 + 核心解析逻辑
│   └── ErrorBoundary.js # 错误边界
├── bridge/
│   └── preload.js      # Electron 预加载脚本
├── dist/               # 构建输出目录（生成）
├── webpack.config.js   # Webpack 配置
├── package.json        # 依赖管理
└── README.md           # 本文件
```

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build
```

### 核心实现

核心解析函数位于 `src/App.js` 的 `parseJavaToString` 方法，采用：

- 字符逐字符解析
- 括号深度追踪（支持嵌套）
- 动态类型识别（字符串、数字、布尔值）
- 递归处理对象和数组

### uTools API

```javascript
// 监听插件进入事件
window.utools.onPluginEnter(({ code, type, payload }) => {
  // code: 'javaToJson'
  // type: 'text'
  // payload: 用户选中的文本
})

// 复制文本到剪贴板
window.utools.copyText(text)

// 监听插件退出事件
window.utools.onPluginOut(() => {
  // 清理逻辑
})
```

### 安全规范

⚠️ **重要**：本项目遵循 Electron 安全实践

- 不在渲染进程直接暴露 Node.js 模块（`fs`、`child_process` 等）
- 通过 `bridge/preload.js` 封装必要的系统服务
- 使用 `window.services` 访问受限 API

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- [uTools](https://u.tools/) - 强大的 productivity launcher
- [React](https://react.dev/) - 用于构建用户界面
- [MUI](https://mui.com/) - 高质量的 React UI 组件库

---

<div align="center">

Made with ❤️ by [Your Name](https://github.com/yourusername)

</div>
