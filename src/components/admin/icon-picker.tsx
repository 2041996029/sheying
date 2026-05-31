'use client';

import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  Camera, Heart, Globe, Star, Zap, Shield, Music, Film, Code,
  Coffee, Sun, Moon, Mountain, TreePine, Flower2, MapPin, Compass,
  Plane, Rocket, Hammer, Settings, Cpu, Smartphone, Monitor, Laptop,
  Palette, BookOpen, Image, Lightbulb, Flame, Droplets, Waves,
  Award, Trophy, Crown, Target, TrendingUp, Activity, Bell,
  Users, UserPlus, HandHeart, Share2, Bookmark, Tag, Sparkle,
  Footprints, Anchor, Cloud, CloudSun, Sunrise, Sunset,
  type LucideIcon,
} from 'lucide-react';

/** 所有可选图标映射：名称 → 组件 */
const ICON_MAP: Record<string, LucideIcon> = {
  Camera, Heart, Globe, Star, Zap, Shield, Music, Film, Code,
  Coffee, Sun, Moon, Mountain, TreePine, Flower2, MapPin, Compass,
  Plane, Rocket, Hammer, Settings, Cpu, Smartphone, Monitor, Laptop,
  Palette, BookOpen, Image, Lightbulb, Flame, Droplets, Waves,
  Award, Trophy, Crown, Target, TrendingUp, Activity, Bell,
  Users, UserPlus, HandHeart, Share2, Bookmark, Tag, Sparkle,
  Footprints, Anchor, Cloud, CloudSun, Sunrise, Sunset,
};

/** 图标分类，方便浏览 */
const ICON_CATEGORIES: Record<string, string[]> = {
  '摄影与艺术': ['Camera', 'Image', 'Film', 'Palette', 'Lightbulb', 'Sparkle'],
  '自然与风光': ['Sun', 'Moon', 'Mountain', 'TreePine', 'Flower2', 'Droplets', 'Waves', 'Cloud', 'CloudSun', 'Sunrise', 'Sunset'],
  '旅行与探索': ['Globe', 'MapPin', 'Compass', 'Plane', 'Rocket', 'Anchor', 'Footprints'],
  '社交与互动': ['Heart', 'Users', 'UserPlus', 'HandHeart', 'Share2', 'Bell', 'Bookmark'],
  '成就与品质': ['Star', 'Award', 'Trophy', 'Crown', 'Target', 'TrendingUp', 'Flame'],
  '科技与工具': ['Code', 'Cpu', 'Smartphone', 'Monitor', 'Laptop', 'Settings', 'Hammer', 'Tag', 'Activity', 'Zap'],
  '生活与爱好': ['Coffee', 'Music', 'Shield', 'Compass'],
};

/** 图标中文标签 */
const ICON_LABELS: Record<string, string> = {
  Camera: '相机', Heart: '爱心', Globe: '地球', Star: '星星', Zap: '闪电', Shield: '盾牌',
  Music: '音乐', Film: '胶片', Code: '代码', Coffee: '咖啡', Sun: '太阳', Moon: '月亮',
  Mountain: '山峰', TreePine: '松树', Flower2: '花朵', MapPin: '地图标记', Compass: '指南针',
  Plane: '飞机', Rocket: '火箭', Hammer: '锤子', Settings: '设置', Cpu: '处理器',
  Smartphone: '手机', Monitor: '显示器', Laptop: '笔记本', Palette: '调色板', BookOpen: '书本',
  Image: '图片', Lightbulb: '灯泡', Flame: '火焰', Droplets: '水滴', Waves: '波浪',
  Award: '奖章', Trophy: '奖杯', Crown: '皇冠', Target: '靶心', TrendingUp: '趋势',
  Activity: '活动', Bell: '铃铛', Users: '用户组', UserPlus: '添加用户', HandHeart: '比心',
  Share2: '分享', Bookmark: '书签', Tag: '标签', Sparkle: '闪光', Footprints: '脚印',
  Anchor: '锚', Cloud: '云', CloudSun: '多云', Sunrise: '日出', Sunset: '日落',
};

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  color?: string;
}

export default function IconPicker({ value, onChange, color }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const SelectedIcon = ICON_MAP[value];

  // 搜索过滤
  const filteredIcons = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword && !activeCategory) return null; // 没搜索时显示分类

    let icons: string[];
    if (activeCategory) {
      icons = ICON_CATEGORIES[activeCategory] || [];
    } else {
      icons = Object.keys(ICON_MAP);
    }

    if (keyword) {
      icons = icons.filter((name) => {
        const label = ICON_LABELS[name] || '';
        return name.toLowerCase().includes(keyword) || label.includes(keyword);
      });
    }
    return icons;
  }, [search, activeCategory]);

  const colorClassMap: Record<string, string> = {
    amber: 'text-amber-500',
    rose: 'text-rose-500',
    emerald: 'text-emerald-500',
    blue: 'text-blue-500',
    violet: 'text-violet-500',
    orange: 'text-orange-500',
    cyan: 'text-cyan-500',
    pink: 'text-pink-500',
  };

  const iconColorClass = color ? (colorClassMap[color] || 'text-stone-600') : 'text-stone-600';

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setOpen(false);
    setSearch('');
    setActiveCategory(null);
  };

  // 渲染图标网格
  const renderIconGrid = (icons: string[]) => (
    <div className="grid grid-cols-6 gap-1">
      {icons.map((iconName) => {
        const Icon = ICON_MAP[iconName];
        if (!Icon) return null;
        const isSelected = iconName === value;
        return (
          <button
            key={iconName}
            type="button"
            onClick={() => handleSelect(iconName)}
            className={`
              flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all
              hover:bg-violet-50 hover:scale-105
              ${isSelected ? 'bg-violet-100 ring-2 ring-violet-400 shadow-sm' : ''}
            `}
            title={`${ICON_LABELS[iconName] || iconName}`}
          >
            <Icon className={`h-5 w-5 ${isSelected ? 'text-violet-600' : 'text-stone-600'}`} />
            <span className={`text-[10px] leading-tight truncate w-full text-center ${isSelected ? 'text-violet-700 font-medium' : 'text-stone-500'}`}>
              {ICON_LABELS[iconName] || iconName}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSearch(''); setActiveCategory(null); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-8 rounded-md border border-stone-200 bg-white px-2 flex items-center gap-2 hover:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-colors"
        >
          {SelectedIcon ? (
            <>
              <SelectedIcon className={`h-4 w-4 flex-shrink-0 ${iconColorClass}`} />
              <span className="text-sm text-stone-700">{value}</span>
              <span className="text-xs text-stone-400">({ICON_LABELS[value] || ''})</span>
            </>
          ) : (
            <span className="text-sm text-stone-400">选择图标</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0"
        align="start"
        sideOffset={4}
      >
        {/* 搜索框 */}
        <div className="p-3 border-b border-stone-100">
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value) setActiveCategory(null); }}
            placeholder="搜索图标（中/英文）..."
            className="h-8 text-sm border-stone-200"
            autoFocus
          />
        </div>

        {/* 分类标签 / 搜索结果 */}
        <div className="p-3 max-h-[320px] overflow-y-auto">
          {filteredIcons ? (
            // 搜索模式：显示过滤后的图标
            filteredIcons.length > 0 ? (
              renderIconGrid(filteredIcons)
            ) : (
              <div className="text-center py-6 text-sm text-stone-400">
                未找到匹配的图标
              </div>
            )
          ) : (
            // 默认模式：按分类显示
            <div className="space-y-4">
              {Object.entries(ICON_CATEGORIES).map(([category, icons]) => (
                <div key={category}>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(activeCategory === category ? null : category)}
                    className="flex items-center gap-2 w-full text-left mb-2 group"
                  >
                    <span className="text-xs font-medium text-stone-600 group-hover:text-violet-600 transition-colors">
                      {category}
                    </span>
                    <span className="text-[10px] text-stone-400">{icons.filter(n => ICON_MAP[n]).length} 个</span>
                    <div className="flex-1 h-px bg-stone-100" />
                  </button>
                  {renderIconGrid(icons.filter(n => ICON_MAP[n]))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部已选提示 */}
        {value && (
          <div className="px-3 py-2 border-t border-stone-100 bg-stone-50/50 flex items-center gap-2">
            <span className="text-[10px] text-stone-400">当前选择：</span>
            {SelectedIcon && <SelectedIcon className="h-3.5 w-3.5 text-violet-500" />}
            <span className="text-xs text-stone-600 font-medium">{value}</span>
            <span className="text-[10px] text-stone-400">{ICON_LABELS[value] && `(${ICON_LABELS[value]})`}</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
