# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

梦想变装 (Dream Dress-Up) - 一个让孩子拍照并实现梦想变装的 AI 应用。用户拍照后输入梦想描述，AI 会生成变装后的图片，具有拍立得相机风格界面和胶片显影动画效果。

## Commands

```bash
npm run dev      # 启动开发服务器 (localhost:5173)
npm run build    # TypeScript 编译 + Vite 构建
npm run lint     # ESLint 检查
npm run preview  # 预览生产构建
```

## Tech Stack

- React 19 + TypeScript 5.9
- Vite 7
- 纯 CSS3（无 UI 框架）
- 支持深色/浅色模式自动切换（跟随系统设置）

## Architecture

```
src/
├── App.tsx                 # 主应用组件（包含所有 UI 和状态逻辑）
├── App.css                 # 主样式文件
├── types/index.ts          # TypeScript 类型定义 + 图像模型配置
├── services/
│   ├── settings.ts         # 设置管理器（localStorage + URL 参数）
│   └── image-api.ts        # AI 图像生成 API 调用
└── constants/dreams.ts     # 提示词模板定义
```

### 核心数据流

1. **拍照/上传** → `capturedPhoto` state → 左侧表单输入梦想
2. **确认生成** → 创建 `FilmPhoto` 对象（带弹出动画）→ 调用 `generateImage` API
3. **显影动画** → `developProgress` 从 0 到 100 → 完成后转为 `HistoryItem` 存入 localStorage

### 关键状态

- `films: FilmPhoto[]` - 正在生成/显影中的胶片（画板上可拖拽）
- `history: HistoryItem[]` - 已完成的照片（持久化到 localStorage）
- 胶片状态流转：`isEjecting` → `isGenerating` → `isDeveloping` → 完成

### API 集成

- 使用 OpenAI 兼容的图像生成 API（默认 `api.tu-zi.com`）
- 支持通过 URL 参数传入 API 配置：`?apiKey=xxx` 或 `?settings={"key":"xxx","url":"xxx"}`
- 模型配置在 `src/types/index.ts` 的 `IMAGE_MODELS` 数组中

### 主题系统

- 使用 CSS 变量实现深浅色主题，定义在 `src/index.css`
- 通过 `@media (prefers-color-scheme: dark)` 自动切换
- 主要变量：`--bg-primary`, `--text-primary`, `--card-bg`, `--border-color` 等
