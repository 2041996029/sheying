import type { SortValue } from './types/search';

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_HISTORY_KEY = 'search_history';
export const SEARCH_HISTORY_MAX_ITEMS = 10;
export const SEARCH_HOT_SUGGESTIONS = ['风景', '人像', '街拍', '夜景', '旅行', '建筑', '花卉', '航拍'];

export const CATEGORY_EMOJI_MAP: Record<string, string> = {
  '风景': '🏔️',
  '人像': '👤',
  '街拍': '🏙️',
  '建筑': '🏛️',
  '美食': '🍜',
  '旅行': '✈️',
  '动物': '🐾',
  '花卉': '🌸',
  '夜景': '🌙',
  '纪实': '📸',
  '微距': '🔍',
  '黑白': '⬛',
  '航拍': '🚁',
  '水下': '🌊',
};

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'latest', label: '最新' },
  { value: 'popular', label: '热门' },
  { value: 'most_liked', label: '最多点赞' },
];

export const APERTURE_ROTATION_PERIOD = 8;
export const PULSE_SCALE = 1.1;
export const PULSE_PERIOD = 2;
export const BREATH_PERIOD = 2;
export const SCROLL_HIDE_THRESHOLD = 100;

export const GLASS_BLUR = 12;
export const GLASS_BG_OPACITY = 0.6;
export const GLASS_GLOW_WIDTH = 15;
