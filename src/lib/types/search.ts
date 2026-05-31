export interface SearchQueryParams {
  q: string;
  category_id?: string;
  sort?: SortValue;
  page?: number;
  page_size?: number;
}

export type SortValue = 'latest' | 'popular' | 'most_liked';

export interface CategoryFilterItem {
  id: string;
  name: string;
  workCount?: number;
  emoji?: string;
}

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

export interface SearchHistoryStorage {
  items: string[];
  updatedAt: number;
}
