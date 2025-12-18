/**
 * 类型定义
 */

// API 配置
export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  modelName?: string;
  timeout?: number;
}

// 职业/梦想类型
export interface Dream {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  prompt: string;
}

// 生成状态
export type GenerationStatus = 'idle' | 'uploading' | 'generating' | 'success' | 'error';

// 生成结果
export interface GenerationResult {
  imageUrl: string;
  dream: Dream;
  originalPhoto: string;
}
