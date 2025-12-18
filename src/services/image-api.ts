/**
 * 图片生成 API 服务
 * 从 aitu 项目适配
 */

import { settingsManager } from './settings';

export interface GenerateImageOptions {
  size?: string;
  image?: string | string[];
  quality?: '1k' | '2k' | '4k';
}

export interface GenerateImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

/**
 * 调用图片生成 API
 */
export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<GenerateImageResponse> {
  const config = settingsManager.getConfig();

  if (!config.apiKey) {
    throw new Error('请先配置 API Key');
  }

  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };

  // 构建请求体
  const data: Record<string, unknown> = {
    model: config.modelName || 'gemini-3-pro-image-preview-vip',
    prompt: prompt,
    response_format: 'url',
  };

  // size 参数
  if (options.size && options.size !== 'auto') {
    data.size = options.size;
  }

  // image 参数（参考图）
  if (options.image) {
    data.image = options.image;
  }

  // quality 参数
  if (options.quality) {
    data.quality = options.quality;
  }

  const url = `${config.baseUrl}/images/generations`;

  console.log('[ImageAPI] Generating image with prompt:', prompt);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(config.timeout || 600000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ImageAPI] Request failed:', response.status, errorText);
    throw new Error(`图片生成失败: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('[ImageAPI] Generation successful');

  return result;
}

/**
 * 将 File 转换为 base64 URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 压缩图片
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // 计算缩放比例
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
