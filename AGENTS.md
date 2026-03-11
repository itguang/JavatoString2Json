# AGENTS.md

Project is a uTools plugin (Electron-based launcher) that converts Java `toString()` output to JSON format.

## Build Commands

```bash
npm install              # Install dependencies (uses npmmirror.com registry via .npmrc)
npm run dev              # Watch mode development build (webpack -w --mode development)
npm run build            # Production build (webpack --mode production)
```

Output goes to `dist/`. No test framework or linter is configured.

## Architecture

Webpack dual-entry build (`webpack.config.js`):
- `electron-preload` target: compiles `bridge/preload.js` → `dist/preload.js` (Node.js/Electron APIs)
- `web` target: compiles `src/index.js` → `dist/index.js` (React UI), copies `public/` to `dist/`

uTools plugin manifest: `public/plugin.json` (feature code: `javaToJson`)

Core parser: `parseJavaToString()` function in `src/App.js` handles `{key=value}` format recursively.

## Code Style Guidelines

### Imports
- Third-party libraries first: React, then MUI components/icons
- Local imports last using relative paths: `import App from './App'`
- Destructure named imports where appropriate: `import { useEffect, useState } from 'react'`
- Import order: React → MUI → local files

### Formatting
- 2-space indentation
- No trailing commas in LESS files
- Semicolons required in JavaScript
- Space after keywords and between braces: `function name () {}`
- Comments use Chinese for UI-facing text

### Naming Conventions
- Components: PascalCase (App, ErrorBoundary)
- Event handlers: camelCase with "handle" prefix (handleConvert, handleKeyDown)
- Functions: camelCase starting with verbs
- Variables: camelCase
- Constants: SCREAMING_SNAKE_CASE for theme/config objects (THEME_DIC)
- Files: PascalCase matching component name (App.js)

### Components
- Use function components with explicit naming: `export default function App ()`
- Class components only for ErrorBoundary (required by React lifecycle)
- State management with React hooks (`useState`, `useEffect`, `useRef`)
- MUI for UI components with `sx` prop for custom styles
- Wrap app in ErrorBoundary component at root level

### Error Handling
- Global error boundary in `ErrorBoundary.js` catches rendering errors
- Use `try-catch` blocks for parsing operations
- Set error state with descriptive Chinese messages
- Display errors to user via MUI Alert or inline error text
- No formal logging framework - log via `console.error` for debugging

### uTools Integration
- Access uTools API via `window.utools`
- Use `onPluginEnter` to receive input payload
- Use `copyText()` for clipboard operations
- Access Node.js services via `window.services` (exposed from preload)
- Never expose raw Node.js modules (`fs`, `child_process`) directly to renderer
- Wrap Node.js capabilities as functions in `bridge/preload.js`

### Styling
- Use MUI components with `sx` prop for component-level styles
- Use LESS for global styles in `src/index.less`
- Dark mode support via `@media (prefers-color-scheme: dark)`
- Monospace fonts for code display: `fontFamily: 'monospace'`

### Core Parser (parseJavaToString)
- Character-by-character parsing with bracket/brace depth tracking
- Supports nested objects, arrays, quoted strings, primitives
- Handles `ClassName@hashcode` format
- Returns JSON string formatted with 2-space indentation

## Tech Stack

React 19, MUI 7, Webpack 5, Babel (targets Chrome 108 / Electron 22), Less for styles.

## Language

UI and user-facing text is in Chinese (zh-CN). Comments in code use Chinese for user-explaining text.

## Testing

No test framework configured. Manual testing via uTools integration.
