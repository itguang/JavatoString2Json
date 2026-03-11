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
