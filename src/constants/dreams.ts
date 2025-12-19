/**
 * 生成自定义梦想的提示词
 */
export function generateCustomPrompt(customDream: string): string {
  return `根据这张照片生成一张新图片。

孩子的梦想是：${customDream}

要求：
1. 保持照片中孩子的面部特征完全一致，包括五官、表情
2. 根据孩子的梦想，给孩子穿上合适的服装或造型
3. 背景要符合梦想的场景
4. 整体氛围：快乐、自信、充满希望`;
}
