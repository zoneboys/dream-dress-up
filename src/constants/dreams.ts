/**
 * 梦想/职业配置
 * 包含内置提示词模板
 */

import type { Dream } from '../types';

/**
 * 基础提示词模板
 * {profession} 会被替换为具体职业
 * {description} 会被替换为职业描述
 */
const BASE_PROMPT = `Transform this child photo into a cute young {profession}.
The child should be wearing professional {description}.
IMPORTANT: Keep the child's face exactly the same, maintain facial features and expression.
Style: Bright, colorful, child-friendly cartoon/Disney Pixar style.
Background: Appropriate professional environment.
Mood: Happy, confident, inspiring.
The result should look like a professional portrait that celebrates children's dreams.`;

/**
 * 预设的梦想/职业列表
 */
export const DREAMS: Dream[] = [
  {
    id: 'astronaut',
    name: '宇航员',
    nameEn: 'Astronaut',
    icon: '🚀',
    prompt: BASE_PROMPT
      .replace('{profession}', 'astronaut')
      .replace('{description}', 'a white space suit with helmet, standing in front of a space shuttle or on the moon with Earth in the background'),
  },
  {
    id: 'doctor',
    name: '医生',
    nameEn: 'Doctor',
    icon: '👨‍⚕️',
    prompt: BASE_PROMPT
      .replace('{profession}', 'doctor')
      .replace('{description}', 'a white lab coat with stethoscope around neck, in a bright and friendly hospital or clinic setting'),
  },
  {
    id: 'firefighter',
    name: '消防员',
    nameEn: 'Firefighter',
    icon: '🚒',
    prompt: BASE_PROMPT
      .replace('{profession}', 'firefighter')
      .replace('{description}', 'a firefighter uniform with helmet, standing proudly in front of a fire truck'),
  },
  {
    id: 'scientist',
    name: '科学家',
    nameEn: 'Scientist',
    icon: '🔬',
    prompt: BASE_PROMPT
      .replace('{profession}', 'scientist')
      .replace('{description}', 'a lab coat with safety goggles, in a colorful laboratory with beakers and scientific equipment'),
  },
  {
    id: 'teacher',
    name: '教师',
    nameEn: 'Teacher',
    icon: '📚',
    prompt: BASE_PROMPT
      .replace('{profession}', 'teacher')
      .replace('{description}', 'professional teaching attire, standing in front of a colorful classroom blackboard with books'),
  },
  {
    id: 'pilot',
    name: '飞行员',
    nameEn: 'Pilot',
    icon: '✈️',
    prompt: BASE_PROMPT
      .replace('{profession}', 'pilot')
      .replace('{description}', 'a pilot uniform with captain hat, in an airplane cockpit or in front of a plane'),
  },
  {
    id: 'chef',
    name: '厨师',
    nameEn: 'Chef',
    icon: '👨‍🍳',
    prompt: BASE_PROMPT
      .replace('{profession}', 'chef')
      .replace('{description}', 'a white chef coat and tall chef hat, in a professional kitchen with cooking utensils'),
  },
  {
    id: 'artist',
    name: '艺术家',
    nameEn: 'Artist',
    icon: '🎨',
    prompt: BASE_PROMPT
      .replace('{profession}', 'artist')
      .replace('{description}', 'artistic clothing with paint splashes, holding a palette and brush in a colorful art studio'),
  },
  {
    id: 'athlete',
    name: '运动员',
    nameEn: 'Athlete',
    icon: '🏅',
    prompt: BASE_PROMPT
      .replace('{profession}', 'Olympic athlete')
      .replace('{description}', 'a sports uniform, standing on a winner podium with a gold medal, in a stadium'),
  },
  {
    id: 'musician',
    name: '音乐家',
    nameEn: 'Musician',
    icon: '🎵',
    prompt: BASE_PROMPT
      .replace('{profession}', 'musician')
      .replace('{description}', 'elegant performance attire, holding a musical instrument on a concert stage with lights'),
  },
  {
    id: 'police',
    name: '警察',
    nameEn: 'Police Officer',
    icon: '👮',
    prompt: BASE_PROMPT
      .replace('{profession}', 'police officer')
      .replace('{description}', 'a police uniform with badge, standing protectively in a friendly neighborhood'),
  },
  {
    id: 'engineer',
    name: '工程师',
    nameEn: 'Engineer',
    icon: '⚙️',
    prompt: BASE_PROMPT
      .replace('{profession}', 'engineer')
      .replace('{description}', 'work clothes with safety helmet, at a construction site or with robots/machines'),
  },
  {
    id: 'veterinarian',
    name: '兽医',
    nameEn: 'Veterinarian',
    icon: '🐾',
    prompt: BASE_PROMPT
      .replace('{profession}', 'veterinarian')
      .replace('{description}', 'a veterinary coat with stethoscope, in a pet clinic surrounded by cute animals'),
  },
  {
    id: 'superhero',
    name: '超级英雄',
    nameEn: 'Superhero',
    icon: '🦸',
    prompt: BASE_PROMPT
      .replace('{profession}', 'superhero')
      .replace('{description}', 'a colorful superhero costume with cape, flying pose with city skyline in background'),
  },
  {
    id: 'princess',
    name: '公主/王子',
    nameEn: 'Princess/Prince',
    icon: '👑',
    prompt: BASE_PROMPT
      .replace('{profession}', 'royal princess or prince')
      .replace('{description}', 'a beautiful royal gown or prince outfit with crown, in a magical fairy tale castle'),
  },
  {
    id: 'explorer',
    name: '探险家',
    nameEn: 'Explorer',
    icon: '🧭',
    prompt: BASE_PROMPT
      .replace('{profession}', 'explorer')
      .replace('{description}', 'adventure gear with hat and backpack, in a jungle or ancient ruins discovering treasures'),
  },
];

/**
 * 根据 ID 获取梦想
 */
export function getDreamById(id: string): Dream | undefined {
  return DREAMS.find(dream => dream.id === id);
}

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
