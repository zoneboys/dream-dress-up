# 梦想变装 (Dream Dress-Up)

一个让孩子拍照并实现梦想变装的 AI 应用。孩子可以拍照后输入自己的梦想（想成为什么样的人），然后 AI 会生成一张变装后的图片。

## 功能特点

- 实时摄像头拍照或上传照片
- 输入姓名（可选）和梦想描述
- AI 根据梦想生成变装图片
- 历史记录保存在浏览器本地
- 画廊展示所有变装记录
- 支持下载生成的图片

## 技术栈

- React 18 + TypeScript
- Vite
- CSS3 (响应式设计)

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

## API 配置

首次使用时需要配置 API Key。可以通过以下方式配置：

1. 首次生成图片时会弹窗提示输入
2. 通过 URL 参数: `?apiKey=your-api-key`
3. 通过 URL 参数 (JSON): `?settings={"key":"your-api-key","url":"https://api.example.com/v1"}`

API Key 获取地址: https://api.tu-zi.com/token

## 使用说明

1. 打开应用，允许摄像头权限
2. 点击拍照按钮拍摄照片，或点击"上传照片"选择本地图片
3. 确认照片后，输入姓名（可选）和梦想描述
4. 点击"开始变装"等待 AI 生成
5. 生成完成后可以保存图片或继续拍摄
6. 点击右上角"历史记录"查看所有变装记录

## 注意事项

- 摄像头功能需要在 localhost 或 HTTPS 环境下使用
- 历史记录保存在浏览器 localStorage 中
- 建议使用现代浏览器（Chrome、Firefox、Safari、Edge）

## License

MIT
