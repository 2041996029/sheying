// 主题预设元数据定义

export type ThemePresetId = 'classic' | 'warm-sunrise' | 'cream-latte' | 'morning-mist' | 'sakura';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  /** 亮色模式下的色板预览（4色：背景/卡片/主色/强调色） */
  lightColors: [string, string, string, string];
  /** 暗色模式下的色板预览 */
  darkColors: [string, string, string, string];
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic',
    name: '经典',
    description: '暖琥珀中性调，优雅专业',
    lightColors: ['#f6f3ee', '#fefcf9', '#a0652a', '#ede6da'],
    darkColors: ['#222120', '#2e2d2c', '#d4a24e', '#3d3b38'],
  },
  {
    id: 'warm-sunrise',
    name: '暖阳',
    description: '蜜桃暖调，晨光温润',
    lightColors: ['#fdf0e8', '#fef7f2', '#c76840', '#f0d8ca'],
    darkColors: ['#25201c', '#302a24', '#e08a5c', '#3d3430'],
  },
  {
    id: 'cream-latte',
    name: '奶油',
    description: '拿铁质感，沉稳温暖',
    lightColors: ['#f8f2e8', '#fefaf4', '#9e7e48', '#ede0cc'],
    darkColors: ['#25221a', '#302c22', '#c4a058', '#3d3828'],
  },
  {
    id: 'morning-mist',
    name: '晨雾',
    description: '靛蓝清雅，现代高级',
    lightColors: ['#edf1fa', '#f7f9fe', '#4870b8', '#d8e0f0'],
    darkColors: ['#1c2030', '#242a3a', '#7098d8', '#303848'],
  },
  {
    id: 'sakura',
    name: '樱花',
    description: '玫粉柔美，浪漫轻盈',
    lightColors: ['#fdf0f3', '#fef8f9', '#c04878', '#f0d4e0'],
    darkColors: ['#281c24', '#342430', '#e06898', '#3d2838'],
  },
];

export const DEFAULT_THEME_PRESET: ThemePresetId = 'classic';
