'use client';

import { useEffect, useState, useCallback } from 'react';
import { configsApi, type ConfigItem } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Eye,
  EyeOff,
  Loader2,
  Save,
  Cloud,
  HardDrive,
  Plug,
  CheckCircle2,
  XCircle,
  Smartphone,
  ImageIcon,
  Type,
  MapPin,
  Camera,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Shield,
  Globe,
  Copy,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import IconPicker from '@/components/admin/icon-picker';

interface MilestoneItem {
  phase: string;
  title: string;
  desc: string;
  active?: boolean;
}

const DEFAULT_MILESTONES: MilestoneItem[] = [
  { phase: '阶段 01', title: '灵感萌发', desc: '一个关于光影的梦想开始发芽，希望为摄影爱好者搭建专属的展示空间。' },
  { phase: '阶段 02', title: '精心打造', desc: '从界面到交互，从功能到体验，每一个细节都反复打磨，追求极致。' },
  { phase: '阶段 03', title: '社区成长', desc: '越来越多的摄影师加入，作品库不断丰富，社区氛围日渐浓厚。' },
  { phase: '阶段 04', title: '持续进化', desc: 'AI 辅助、约拍功能、小程序生态……我们一直在路上，永不停歇。', active: true },
];

// 特色功能卡片选项
const FEATURE_COLORS = ['amber', 'rose', 'emerald', 'blue', 'violet', 'orange', 'cyan', 'pink'] as const;
const FEATURE_ICONS = [
  'Camera', 'Heart', 'Globe', 'Star', 'Zap', 'Shield', 'Music', 'Film', 'Code',
  'Coffee', 'Sun', 'Moon', 'Mountain', 'TreePine', 'Flower2', 'MapPin', 'Compass',
  'Plane', 'Rocket', 'Hammer', 'Settings', 'Cpu', 'Smartphone', 'Monitor', 'Laptop',
  'Palette', 'BookOpen', 'Image', 'Lightbulb', 'Flame', 'Droplets', 'Waves',
  'Award', 'Trophy', 'Crown', 'Target', 'TrendingUp', 'Activity', 'Bell',
  'Users', 'UserPlus', 'HandHeart', 'Share2', 'Bookmark', 'Tag', 'Sparkle',
  'Footprints', 'Anchor', 'Cloud', 'CloudSun', 'Sunrise', 'Sunset',
] as const;

interface FeatureItem {
  icon: string;
  color: string;
  title: string;
  content: string;
  english: string;
}

const DEFAULT_FEATURES: FeatureItem[] = [
  { icon: 'Camera', color: 'amber', title: '精选作品', content: '精心策展的摄影作品集，从风光到人像，从街拍到纪实，每一幅作品都经过严格筛选，只为呈现最动人的光影瞬间。', english: 'Curated Gallery' },
  { icon: 'Heart', color: 'rose', title: '互动交流', content: '点赞、收藏、评论，与摄影师零距离互动。每一次真诚的反馈，都是对创作者最好的鼓励与支持。', english: 'Community Driven' },
  { icon: 'Globe', color: 'emerald', title: '开放平台', content: '多维分类与智能标签体系，支持作品分类浏览与精准检索。约拍功能连接摄影师与需求方，构建开放的创作生态。', english: 'Open Ecosystem' },
];

function parseFeatures(json?: string): FeatureItem[] {
  if (!json) return DEFAULT_FEATURES.map((f) => ({ ...f }));
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_FEATURES.map((f) => ({ ...f }));
  } catch {
    return DEFAULT_FEATURES.map((f) => ({ ...f }));
  }
}

function parseMilestones(json?: string): MilestoneItem[] {
  if (!json) return DEFAULT_MILESTONES.map((m) => ({ ...m }));
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_MILESTONES.map((m) => ({ ...m }));
  } catch {
    return DEFAULT_MILESTONES.map((m) => ({ ...m }));
  }
}

const configGroups = [
  { key: 'site', label: '站点配置' },
  { key: 'social', label: '社交配置' },
  { key: 'display', label: '显示配置' },
  { key: 'ai', label: 'AI配置' },
  { key: 'booking', label: '约拍配置' },
  { key: 'about', label: '关于页面配置' },
  { key: 'cos', label: '存储配置' },
  { key: 'miniprogram', label: '小程序配置' },
  { key: 'amap', label: '地图配置' },
  { key: 'email', label: '邮件配置' },
  { key: 'cache', label: '缓存配置' },
  { key: 'auth', label: '认证配置' },
  { key: 'security', label: '安全配置' },
  { key: 'monitor', label: '监控配置' },
  { key: 'exif', label: 'EXIF配置' },
  { key: 'social_login', label: '聚合登录' },
  { key: 'seo', label: 'SEO配置' },
];

interface ClientCredentialItem {
  appId: string;
  appSecret: string;
  name: string;
  clientType: 'web' | 'miniprogram' | 'admin';
  enabled: boolean;
}

export default function ConfigsPage() {
  const [activeGroup, setActiveGroup] = useState('site');
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // 存储配置专用状态
  const [storageMode, setStorageMode] = useState('local');
  const [cosBucket, setCosBucket] = useState('');
  const [cosAppid, setCosAppid] = useState('');
  const [cosRegion, setCosRegion] = useState('');
  const [cosCdnUrl, setCosCdnUrl] = useState('');
  const [cosSecretId, setCosSecretId] = useState('');
  const [cosSecretKey, setCosSecretKey] = useState('');
  const [cosUploadDir, setCosUploadDir] = useState('works');
  const [cosSaving, setCosSaving] = useState(false);
  const [cosTesting, setCosTesting] = useState(false);
  const [cosTestResult, setCosTestResult] = useState<'idle' | 'success' | 'fail'>('idle');

  // 小程序配置专用状态
  const [mpAppId, setMpAppId] = useState('');
  const [mpAppSecret, setMpAppSecret] = useState('');
  const [mpEnvVersion, setMpEnvVersion] = useState('trial');
  const [mpQrcodePage, setMpQrcodePage] = useState('pages/detail/detail');
  const [mpAccessTokenTtl, setMpAccessTokenTtl] = useState('6900');

  // 缓存配置专用状态 (Redis拆分字段)
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheTtl, setCacheTtl] = useState('300');
  const [cacheType] = useState('redis');
  const [redisHost, setRedisHost] = useState('');
  const [redisPort, setRedisPort] = useState('6379');
  const [redisPassword, setRedisPassword] = useState('');
  const [redisDb, setRedisDb] = useState('0');

  // 站点配置 - Hero专用状态
  const [heroImage, setHeroImage] = useState('');
  const [heroTitle, setHeroTitle] = useState('光影集');
  const [heroSubtitle, setHeroSubtitle] = useState('发现精美摄影作品，记录光影之美');

  // 站点配置 - 关于页面专用状态
  const [aboutEyebrow, setAboutEyebrow] = useState('致每一位摄影者');
  const [aboutTitle, setAboutTitle] = useState('致每一位*追光者*');
  const [aboutMilestones, setAboutMilestones] = useState<MilestoneItem[]>([]);
  const [aboutContent, setAboutContent] = useState('');
  const [aboutFeatures, setAboutFeatures] = useState<FeatureItem[]>([]);

  // 约拍配置专用状态
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [bookingCoverImage, setBookingCoverImage] = useState('');
  const [bookingTitle, setBookingTitle] = useState('预约约拍');
  const [bookingSubtitle, setBookingSubtitle] = useState('让我们记录你的美好瞬间');
  const [bookingIntro, setBookingIntro] = useState('欢迎约拍');
  const [bookingPrice, setBookingPrice] = useState('详情请咨询');
  const [bookingNotice, setBookingNotice] = useState('');
  const [bookingContent, setBookingContent] = useState('');

  // 高德地图配置专用状态
  const [amapApiKey, setAmapApiKey] = useState('');
  const [amapJsKey, setAmapJsKey] = useState('');
  const [amapSecurityKey, setAmapSecurityKey] = useState('');
  const [amapTesting, setAmapTesting] = useState(false);
  const [amapTestResult, setAmapTestResult] = useState<'idle' | 'success' | 'fail'>('idle');

  // 聚合登录配置专用状态
  const [socialLoginEnabled, setSocialLoginEnabled] = useState(false);
  const [socialLoginAppid, setSocialLoginAppid] = useState('');
  const [socialLoginAppkey, setSocialLoginAppkey] = useState('');
  const [socialLoginProviders, setSocialLoginProviders] = useState<string[]>([]);
  const [socialLoginRedirectUri, setSocialLoginRedirectUri] = useState('');

  // 安全配置专用状态
  const [accessControlEnabled, setAccessControlEnabled] = useState(false);
  const [apiClients, setApiClients] = useState<ClientCredentialItem[]>([]);
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [skipPublicGet, setSkipPublicGet] = useState(true);
  const [skipAuthPaths, setSkipAuthPaths] = useState(true);
  const [timestampTolerance, setTimestampTolerance] = useState('300');
  const [signKeyTtl, setSignKeyTtl] = useState('86400');
  const [securitySaving, setSecuritySaving] = useState(false);

  const loadConfigs = useCallback(async (group: string) => {
    setLoading(true);
    try {
      const data = await configsApi.group(group);
      setConfigs(data);

      // 初始化编辑值
      const values: Record<string, string> = {};
      for (const c of data) {
        values[c.key] = c.value;
      }
      setEditValues(values);

      // 如果是存储配置，初始化表单
      if (group === 'cos') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        setStorageMode(getConfig('cos_storage_mode') || 'local');
        setCosBucket(getConfig('cos_bucket'));
        setCosAppid(getConfig('cos_appid'));
        setCosRegion(getConfig('cos_region'));
        setCosCdnUrl(getConfig('cos_cdn_url'));
        setCosSecretId(getConfig('cos_secret_id'));
        setCosSecretKey(getConfig('cos_secret_key'));
        setCosUploadDir(getConfig('cos_upload_dir') || 'works');
        setCosTestResult('idle');
      }

      // 如果是小程序配置，初始化表单
      if (group === 'miniprogram') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        setMpAppId(getConfig('miniprogram_appid'));
        setMpAppSecret(getConfig('miniprogram_appsecret'));
        setMpEnvVersion(getConfig('miniprogram_env_version') || 'trial');
        setMpQrcodePage(getConfig('miniprogram_qrcode_page') || 'pages/detail/detail');
        setMpAccessTokenTtl(getConfig('miniprogram_access_token_ttl') || '6900');
      }

      // 如果是缓存配置，初始化Redis拆分字段
      if (group === 'cache') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        // cache_type 固定为 redis
        setCacheEnabled(getConfig('cache_enabled') === 'true');
        setCacheTtl(getConfig('cache_ttl') || '300');
        setRedisHost(getConfig('redis_host'));
        setRedisPort(getConfig('redis_port') || '6379');
        setRedisPassword(getConfig('redis_password'));
        setRedisDb(getConfig('redis_db') || '0');
      }

      // 如果是高德地图配置，初始化表单
      if (group === 'amap') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        setAmapApiKey(getConfig('amap_api_key'));
        setAmapJsKey(getConfig('amap_js_key'));
        setAmapSecurityKey(getConfig('amap_security_key'));
        setAmapTestResult('idle');
      }

      // 如果是站点配置，初始化Hero字段和关于页面字段
      if (group === 'site') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        setHeroImage(getConfig('site_hero_image'));
        setHeroTitle(getConfig('site_hero_title') || '光影集');
        setHeroSubtitle(getConfig('site_hero_subtitle') || '发现精美摄影作品，记录光影之美');
      }

      // 如果是约拍配置，初始化表单
      if (group === 'booking') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        setBookingEnabled(getConfig('booking_enabled') === 'true');
        setBookingCoverImage(getConfig('booking_cover_image'));
        setBookingTitle(getConfig('booking_title') || '预约约拍');
        setBookingSubtitle(getConfig('booking_subtitle') || '让我们记录你的美好瞬间');
        setBookingIntro(getConfig('booking_intro') || '欢迎约拍');
        setBookingPrice(getConfig('booking_price') || '详情请咨询');
        setBookingNotice(getConfig('booking_notice'));
        setBookingContent(getConfig('booking_content'));
      }

      // 如果是关于页面配置，初始化表单
      if (group === 'about') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        setAboutEyebrow(getConfig('about_eyebrow') || '致每一位摄影者');
        setAboutTitle(getConfig('about_title') || '致每一位*追光者*');
        setAboutMilestones(parseMilestones(getConfig('about_milestones')));
        setAboutContent(getConfig('about_content'));
        setAboutFeatures(parseFeatures(getConfig('about_features')));
      }

      // 如果是聚合登录配置，初始化表单
      if (group === 'social_login') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        setSocialLoginEnabled(getConfig('social_login_enabled') === 'true');
        setSocialLoginAppid(getConfig('social_login_appid'));
        setSocialLoginAppkey(getConfig('social_login_appkey'));
        try {
          setSocialLoginProviders(JSON.parse(getConfig('social_login_providers') || '[]'));
        } catch { setSocialLoginProviders([]); }
        setSocialLoginRedirectUri(getConfig('social_login_redirect_uri'));
      }

      // 如果是安全配置，初始化表单
      if (group === 'security') {
        const getConfig = (key: string) => data.find((c) => c.key === key)?.value || '';
        setAccessControlEnabled(getConfig('security_access_control_enabled') === 'true');
        setSkipPublicGet(getConfig('security_skip_public_get') !== 'false');
        setSkipAuthPaths(getConfig('security_skip_auth_paths') !== 'false');
        setTimestampTolerance(getConfig('security_timestamp_tolerance') || '300');
        setSignKeyTtl(getConfig('security_signkey_ttl') || '86400');
        try {
          const parsed = JSON.parse(getConfig('security_api_keys') || '[]');
          if (Array.isArray(parsed)) setApiClients(parsed);
        } catch { setApiClients([]); }
        try {
          const parsed = JSON.parse(getConfig('security_allowed_origins') || '[]');
          if (Array.isArray(parsed)) setAllowedOrigins(parsed.join('\n'));
        } catch { setAllowedOrigins(''); }
      }
    } catch {
      toast.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs(activeGroup);
  }, [activeGroup, loadConfigs]);

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isSensitive = (key: string) => {
    // 使用更精确的敏感词匹配，避免 'key' 误匹配 'keywords'，'token' 误匹配 'token_ttl' 等
    const sensitivePatterns = ['secret', 'password', 'api_key'];
    return sensitivePatterns.some((p) => key.toLowerCase().includes(p))
      || key.toLowerCase().endsWith('_key')
      || key.toLowerCase().endsWith('_token');
  };

  // 判断配置项是否为布尔类型（开关）
  const isBooleanConfig = (key: string, value: string) => {
    return value === 'true' || value === 'false' ||
      key.endsWith('_enabled') || key.endsWith('_switch') ||
      ['display_comment_enabled', 'ai_enabled', 'email_enabled', 'monitor_enabled', 'social_login_enabled'].includes(key);
  };

  // 下拉选择配置项映射（英文值 → 中文标签）
  const SELECT_OPTIONS: Record<string, { value: string; label: string }[]> = {
    display_dark_mode: [
      { value: 'auto', label: '跟随系统' },
      { value: 'light', label: '浅色模式' },
      { value: 'dark', label: '深色模式' },
    ],
    display_theme_preset: [
      { value: 'classic', label: '经典' },
      { value: 'warm-sunrise', label: '暖阳' },
      { value: 'cream-latte', label: '奶油拿铁' },
      { value: 'morning-mist', label: '晨雾' },
      { value: 'sakura', label: '樱花' },
    ],
    display_exif_panel_position: [
      { value: 'right', label: '右侧' },
      { value: 'left', label: '左侧' },
    ],
    seo_og_type: [
      { value: 'website', label: 'Website' },
      { value: 'blog', label: 'Blog' },
      { value: 'article', label: 'Article' },
    ],
    seo_twitter_card: [
      { value: 'summary_large_image', label: '大图摘要 (summary_large_image)' },
      { value: 'summary', label: '普通摘要 (summary)' },
    ],
  };

  // 判断配置项是否为下拉选择类型
  const isSelectConfig = (key: string) => {
    return key in SELECT_OPTIONS;
  };

  // 获取下拉选择配置的中文标签
  const getSelectLabel = (key: string, value: string) => {
    const options = SELECT_OPTIONS[key];
    return options?.find((o) => o.value === value)?.label || value;
  };

  // 内联编辑 - 失焦时自动保存
  const handleInlineBlur = async (config: ConfigItem) => {
    const newValue = editValues[config.key];
    if (newValue === undefined || newValue === config.value) return;

    setSavingKeys((prev) => new Set(prev).add(config.key));
    try {
      await configsApi.updateItem(config.key, newValue);
      toast.success('配置已更新');
      // 更新本地状态
      setConfigs((prev) =>
        prev.map((c) => (c.key === config.key ? { ...c, value: newValue } : c))
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '更新失败');
      // 恢复原值
      setEditValues((prev) => ({ ...prev, [config.key]: config.value }));
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(config.key);
        return next;
      });
    }
  };

  const handleInlineChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  // 保存存储配置
  const handleSaveStorage = async () => {
    setCosSaving(true);
    try {
      const updates = [
        configsApi.updateItem('cos_storage_mode', storageMode),
        configsApi.updateItem('cos_bucket', cosBucket),
        configsApi.updateItem('cos_appid', cosAppid),
        configsApi.updateItem('cos_region', cosRegion),
        configsApi.updateItem('cos_cdn_url', cosCdnUrl),
        configsApi.updateItem('cos_secret_id', cosSecretId),
        configsApi.updateItem('cos_secret_key', cosSecretKey),
        configsApi.updateItem('cos_upload_dir', cosUploadDir),
      ];
      await Promise.all(updates);
      toast.success('存储配置已保存');
      loadConfigs('cos');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setCosSaving(false);
    }
  };

  // 测试COS连接
  const handleTestCos = async () => {
    if (!cosBucket || !cosRegion || !cosSecretId || !cosSecretKey) {
      toast.error('请先填写完整的COS配置');
      return;
    }
    setCosTesting(true);
    setCosTestResult('idle');
    try {
      const token = localStorage.getItem('admin_access_token');
      const res = await fetch('/api/v1/admin/upload/test-cos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bucket: cosBucket,
          region: cosRegion,
          secret_id: cosSecretId,
          secret_key: cosSecretKey,
        }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setCosTestResult('success');
        toast.success('COS连接成功！');
      } else {
        setCosTestResult('fail');
        toast.error(`COS连接失败: ${json.message}`);
      }
    } catch {
      setCosTestResult('fail');
      toast.error('COS连接测试失败');
    } finally {
      setCosTesting(false);
    }
  };

  // 小程序配置内联自动保存
  const handleMpAppIdBlur = async () => {
    const orig = configs.find((c) => c.key === 'miniprogram_appid')?.value || '';
    if (mpAppId !== orig) {
      await handleCacheFieldSave('miniprogram_appid', mpAppId);
    }
  };

  const handleMpAppSecretBlur = async () => {
    const orig = configs.find((c) => c.key === 'miniprogram_appsecret')?.value || '';
    if (mpAppSecret && mpAppSecret !== orig) {
      await handleCacheFieldSave('miniprogram_appsecret', mpAppSecret);
    }
  };

  const handleMpEnvVersionChange = async (val: string) => {
    setMpEnvVersion(val);
    await handleCacheFieldSave('miniprogram_env_version', val);
  };

  const handleMpQrcodePageBlur = async () => {
    const orig = configs.find((c) => c.key === 'miniprogram_qrcode_page')?.value || 'pages/detail/detail';
    if (mpQrcodePage !== orig) {
      await handleCacheFieldSave('miniprogram_qrcode_page', mpQrcodePage);
    }
  };

  const handleMpAccessTokenTtlBlur = async () => {
    const orig = configs.find((c) => c.key === 'miniprogram_access_token_ttl')?.value || '6900';
    if (mpAccessTokenTtl !== orig) {
      await handleCacheFieldSave('miniprogram_access_token_ttl', mpAccessTokenTtl);
    }
  };

  // Hero配置内联自动保存
  const handleHeroImageBlur = async () => {
    const orig = configs.find((c) => c.key === 'site_hero_image')?.value || '';
    if (heroImage !== orig) {
      await handleCacheFieldSave('site_hero_image', heroImage);
    }
  };

  const handleHeroTitleBlur = async () => {
    const orig = configs.find((c) => c.key === 'site_hero_title')?.value || '光影集';
    if (heroTitle !== orig) {
      await handleCacheFieldSave('site_hero_title', heroTitle);
    }
  };

  const handleHeroSubtitleBlur = async () => {
    const orig = configs.find((c) => c.key === 'site_hero_subtitle')?.value || '发现精美摄影作品，记录光影之美';
    if (heroSubtitle !== orig) {
      await handleCacheFieldSave('site_hero_subtitle', heroSubtitle);
    }
  };

  // 关于页面配置内联自动保存
  const handleAboutEyebrowBlur = async () => {
    const orig = configs.find((c) => c.key === 'about_eyebrow')?.value || '致每一位摄影者';
    if (aboutEyebrow !== orig) {
      await handleCacheFieldSave('about_eyebrow', aboutEyebrow);
    }
  };

  const handleAboutTitleBlur = async () => {
    const orig = configs.find((c) => c.key === 'about_title')?.value || '致每一位*追光者*';
    if (aboutTitle !== orig) {
      await handleCacheFieldSave('about_title', aboutTitle);
    }
  };

  const handleAboutContentBlur = async () => {
    const orig = configs.find((c) => c.key === 'about_content')?.value || '';
    if (aboutContent !== orig) {
      await handleCacheFieldSave('about_content', aboutContent);
    }
  };

  const handleAboutMilestonesSave = async () => {
    const jsonStr = JSON.stringify(aboutMilestones);
    const orig = configs.find((c) => c.key === 'about_milestones')?.value || '';
    if (jsonStr !== orig) {
      await handleCacheFieldSave('about_milestones', jsonStr);
    }

    // 保存特色功能卡片
    const featuresStr = JSON.stringify(aboutFeatures);
    const origFeatures = configs.find((c) => c.key === 'about_features')?.value || '';
    if (featuresStr !== origFeatures) {
      await handleCacheFieldSave('about_features', featuresStr);
    }
  };

  const handleAddMilestone = () => {
    const nextPhase = aboutMilestones.length + 1;
    setAboutMilestones((prev) => [
      ...prev,
      { phase: `阶段 ${String(nextPhase).padStart(2, '0')}`, title: '', desc: '', active: false },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setAboutMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, field: keyof MilestoneItem, value: string | boolean) => {
    setAboutMilestones((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleMoveMilestone = (index: number, direction: 'up' | 'down') => {
    setAboutMilestones((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  // 约拍配置内联自动保存
  const handleBookingEnabledChange = async (val: boolean) => {
    setBookingEnabled(val);
    await handleCacheFieldSave('booking_enabled', val ? 'true' : 'false');
  };

  const handleBookingCoverImageBlur = async () => {
    const orig = configs.find((c) => c.key === 'booking_cover_image')?.value || '';
    if (bookingCoverImage !== orig) {
      await handleCacheFieldSave('booking_cover_image', bookingCoverImage);
    }
  };

  const handleBookingTitleBlur = async () => {
    const orig = configs.find((c) => c.key === 'booking_title')?.value || '预约约拍';
    if (bookingTitle !== orig) {
      await handleCacheFieldSave('booking_title', bookingTitle);
    }
  };

  const handleBookingSubtitleBlur = async () => {
    const orig = configs.find((c) => c.key === 'booking_subtitle')?.value || '让我们记录你的美好瞬间';
    if (bookingSubtitle !== orig) {
      await handleCacheFieldSave('booking_subtitle', bookingSubtitle);
    }
  };

  const handleBookingIntroBlur = async () => {
    const orig = configs.find((c) => c.key === 'booking_intro')?.value || '欢迎约拍';
    if (bookingIntro !== orig) {
      await handleCacheFieldSave('booking_intro', bookingIntro);
    }
  };

  const handleBookingPriceBlur = async () => {
    const orig = configs.find((c) => c.key === 'booking_price')?.value || '详情请咨询';
    if (bookingPrice !== orig) {
      await handleCacheFieldSave('booking_price', bookingPrice);
    }
  };

  const handleBookingNoticeBlur = async () => {
    const orig = configs.find((c) => c.key === 'booking_notice')?.value || '';
    if (bookingNotice !== orig) {
      await handleCacheFieldSave('booking_notice', bookingNotice);
    }
  };

  const handleBookingContentBlur = async () => {
    const orig = configs.find((c) => c.key === 'booking_content')?.value || '';
    if (bookingContent !== orig) {
      await handleCacheFieldSave('booking_content', bookingContent);
    }
  };

  // 高德地图配置内联自动保存
  const handleAmapApiKeyBlur = async () => {
    const orig = configs.find((c) => c.key === 'amap_api_key')?.value || '';
    if (amapApiKey && amapApiKey !== orig) {
      await handleCacheFieldSave('amap_api_key', amapApiKey);
    }
  };

  const handleAmapJsKeyBlur = async () => {
    const orig = configs.find((c) => c.key === 'amap_js_key')?.value || '';
    if (amapJsKey !== orig) {
      await handleCacheFieldSave('amap_js_key', amapJsKey);
    }
  };

  const handleAmapSecurityKeyBlur = async () => {
    const orig = configs.find((c) => c.key === 'amap_security_key')?.value || '';
    if (amapSecurityKey && amapSecurityKey !== orig) {
      await handleCacheFieldSave('amap_security_key', amapSecurityKey);
    }
  };

  // 高德地图配置测试
  const handleTestAmap = async () => {
    setAmapTesting(true);
    setAmapTestResult('idle');
    try {
      const token = localStorage.getItem('admin_access_token');
      const res = await fetch('/api/v1/amap/test', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.apiValid) {
        setAmapTestResult('success');
        toast.success('高德地图配置正常！');
      } else {
        setAmapTestResult('fail');
        const results = json.data?.results;
        let msg = json.message || '配置存在问题';
        if (results) {
          const parts: string[] = [];
          if (!results.apiKey?.valid) parts.push('Web服务Key: ' + (results.apiKey?.message || '无效'));
          if (!results.jsKey?.configured) parts.push('JS Key: 未配置');
          toast.error(parts.length > 0 ? parts.join('；') : msg);
        } else {
          toast.error(msg);
        }
      }
    } catch {
      setAmapTestResult('fail');
      toast.error('高德地图测试请求失败');
    } finally {
      setAmapTesting(false);
    }
  };

  // 约拍配置专用渲染 (内联编辑，失焦自动保存)
  const renderBookingConfig = () => (
    <div className="space-y-6">
      {/* 功能开关 */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50">
              <Camera className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <CardTitle className="text-base text-stone-800">约拍功能</CardTitle>
              <CardDescription>控制约拍页面的访问和显示，修改后失焦自动保存</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">约拍功能开关</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">booking_enabled</p>
              </div>
              <div className="flex items-center gap-2">
                {savingKeys.has('booking_enabled') && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                <Switch checked={bookingEnabled} onCheckedChange={handleBookingEnabledChange} />
                <span className="text-sm text-stone-500">{bookingEnabled ? '开启' : '关闭'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 封面图配置 */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <ImageIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base text-stone-800">约拍封面配置</CardTitle>
              <CardDescription>配置约拍页面的封面图和标题，修改后失焦自动保存</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* 封面图URL */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">封面图URL</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">booking_cover_image</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={bookingCoverImage}
                    onChange={(e) => setBookingCoverImage(e.target.value)}
                    onBlur={handleBookingCoverImageBlur}
                    placeholder="留空则使用默认封面图"
                    className={`border-stone-200 text-sm h-8 ${savingKeys.has('booking_cover_image') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('booking_cover_image') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 封面图预览 */}
            {bookingCoverImage && (
              <div className="px-4 py-2">
                <div className="relative rounded-lg overflow-hidden h-32 bg-stone-100">
                  <img
                    src={bookingCoverImage}
                    alt="约拍封面预览"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
                  <div className="absolute bottom-2 left-3 text-white text-xs font-medium drop-shadow">
                    {bookingTitle} · {bookingSubtitle}
                  </div>
                </div>
              </div>
            )}

            {/* 页面标题 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <Type className="h-3.5 w-3.5 text-stone-400" />
                  <span className="text-sm font-medium text-stone-700">页面标题</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">booking_title</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={bookingTitle}
                    onChange={(e) => setBookingTitle(e.target.value)}
                    onBlur={handleBookingTitleBlur}
                    placeholder="预约约拍"
                    className={`border-stone-200 text-sm h-8 ${savingKeys.has('booking_title') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('booking_title') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 页面副标题 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <Type className="h-3.5 w-3.5 text-stone-400" />
                  <span className="text-sm font-medium text-stone-700">页面副标题</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">booking_subtitle</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={bookingSubtitle}
                    onChange={(e) => setBookingSubtitle(e.target.value)}
                    onBlur={handleBookingSubtitleBlur}
                    placeholder="让我们记录你的美好瞬间"
                    className={`border-stone-200 text-sm h-8 ${savingKeys.has('booking_subtitle') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('booking_subtitle') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 约拍内容配置 */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50">
              <Type className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <CardTitle className="text-base text-stone-800">约拍内容配置</CardTitle>
              <CardDescription>配置约拍页面的介绍、收费、须知和详细内容，修改后失焦自动保存</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* 约拍介绍 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <Type className="h-3.5 w-3.5 text-stone-400" />
                  <span className="text-sm font-medium text-stone-700">约拍介绍</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">booking_intro</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={bookingIntro}
                    onChange={(e) => setBookingIntro(e.target.value)}
                    onBlur={handleBookingIntroBlur}
                    placeholder="欢迎约拍"
                    className={`border-stone-200 text-sm h-8 ${savingKeys.has('booking_intro') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('booking_intro') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 收费标准 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <Type className="h-3.5 w-3.5 text-stone-400" />
                  <span className="text-sm font-medium text-stone-700">收费标准</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">booking_price</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={bookingPrice}
                    onChange={(e) => setBookingPrice(e.target.value)}
                    onBlur={handleBookingPriceBlur}
                    placeholder="详情请咨询"
                    className={`border-stone-200 text-sm h-8 ${savingKeys.has('booking_price') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('booking_price') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 约拍须知 */}
            <div className="rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-stone-700">约拍须知</span>
                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-600">多行</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5 font-mono mb-2">booking_notice · 约拍前需要了解的注意事项</p>
              <textarea
                value={bookingNotice}
                onChange={(e) => setBookingNotice(e.target.value)}
                onBlur={handleBookingNoticeBlur}
                rows={4}
                placeholder={"1. 请提前至少3天预约\n2. 拍摄当天请准时到达\n3. 如需改期请提前24小时通知\n4. 定金不予退还"}
                className={`w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-y leading-relaxed ${savingKeys.has('booking_notice') ? 'opacity-60' : ''}`}
              />
              {savingKeys.has('booking_notice') && (
                <div className="flex items-center gap-1 mt-1 text-stone-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-[10px]">保存中...</span>
                </div>
              )}
            </div>

            {/* 约拍页面内容 (Markdown) */}
            <div className="rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-stone-700">约拍详细内容</span>
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-600">Markdown</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5 font-mono mb-2">booking_content · 支持Markdown语法，填写后将替代介绍/收费/须知三个字段</p>
              <textarea
                value={bookingContent}
                onChange={(e) => setBookingContent(e.target.value)}
                onBlur={handleBookingContentBlur}
                rows={8}
                placeholder={"## 约拍服务\n\n提供专业摄影服务，风格涵盖人像、风景、活动等。\n\n### 服务流程\n\n1. **沟通需求** — 了解您的拍摄想法和风格偏好\n2. **制定方案** — 规划拍摄地点、时间和造型\n3. **正式拍摄** — 专业设备，精心拍摄\n4. **后期修图** — 精选照片，精细修图\n\n> 每一次快门，都是为了记录最真实的你。"}
                className={`w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-y font-mono leading-relaxed ${savingKeys.has('booking_content') ? 'opacity-60' : ''}`}
              />
              {savingKeys.has('booking_content') && (
                <div className="flex items-center gap-1 mt-1 text-stone-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-[10px]">保存中...</span>
                </div>
              )}
              <p className="text-[10px] text-stone-400 mt-1.5">支持 Markdown 语法：**粗体** *斜体* [链接](url) - 列表 &gt; 引用 等</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 配置说明 */}
      <Card className="border-rose-200 bg-rose-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Camera className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="text-sm text-stone-700 space-y-1">
              <p className="font-medium">配置说明</p>
              <p>1. 「约拍功能开关」关闭后前端约拍页面将不可访问</p>
              <p>2. 「封面图URL」自定义约拍页面的封面横幅图，留空使用默认图片</p>
              <p>3. 「约拍介绍」显示在约拍页面顶部，简短介绍约拍服务</p>
              <p>4. 「收费标准」展示拍摄价格信息，支持文字描述</p>
              <p>5. 「约拍须知」列出预约前需了解的注意事项，支持多行文本</p>
              <p>6. 「约拍详细内容」支持 Markdown 语法，填写后将替代介绍/收费/须知三个字段</p>
              <p>7. 所有字段修改后点击其他区域自动保存</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 站点配置专用渲染 (Hero区域 + 关于页面 + 通用配置列表)
  const renderSiteConfig = () => {
    // Hero专用配置项key列表，这些在通用列表中不重复显示
    const heroKeys = new Set(['site_hero_image', 'site_hero_title', 'site_hero_subtitle']);
    const otherConfigs = configs.filter((c) => !heroKeys.has(c.key));

    return (
      <div className="space-y-6">
        {/* Hero配置卡片 */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <ImageIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base text-stone-800">首页Hero配置</CardTitle>
                <CardDescription>配置首页背景图和标题文字，修改后失焦自动保存</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* 背景图URL */}
              <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0 max-w-[50%]">
                  <span className="text-sm font-medium text-stone-700">首页背景图URL</span>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">site_hero_image</p>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                  <div className="relative flex-1">
                    <Input
                      value={heroImage}
                      onChange={(e) => setHeroImage(e.target.value)}
                      onBlur={handleHeroImageBlur}
                      placeholder="留空则使用精选作品封面"
                      className={`border-stone-200 text-sm h-8 ${savingKeys.has('site_hero_image') ? 'opacity-60 pr-8' : ''}`}
                    />
                    {savingKeys.has('site_hero_image') && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 背景图预览 */}
              {heroImage && (
                <div className="px-4 py-2">
                  <div className="relative rounded-lg overflow-hidden h-32 bg-stone-100">
                    <img
                      src={heroImage}
                      alt="Hero背景预览"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
                    <div className="absolute bottom-2 left-3 text-white text-xs font-medium drop-shadow">
                      {heroTitle} · {heroSubtitle}
                    </div>
                  </div>
                </div>
              )}

              {/* 主标题 */}
              <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0 max-w-[50%]">
                  <div className="flex items-center gap-2">
                    <Type className="h-3.5 w-3.5 text-stone-400" />
                    <span className="text-sm font-medium text-stone-700">首页主标题</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">site_hero_title</p>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                  <div className="relative flex-1">
                    <Input
                      value={heroTitle}
                      onChange={(e) => setHeroTitle(e.target.value)}
                      onBlur={handleHeroTitleBlur}
                      placeholder="留空则使用站点名称"
                      className={`border-stone-200 text-sm h-8 ${savingKeys.has('site_hero_title') ? 'opacity-60 pr-8' : ''}`}
                    />
                    {savingKeys.has('site_hero_title') && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 副标题 */}
              <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0 max-w-[50%]">
                  <div className="flex items-center gap-2">
                    <Type className="h-3.5 w-3.5 text-stone-400" />
                    <span className="text-sm font-medium text-stone-700">首页副标题</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">site_hero_subtitle</p>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                  <div className="relative flex-1">
                    <Input
                      value={heroSubtitle}
                      onChange={(e) => setHeroSubtitle(e.target.value)}
                      onBlur={handleHeroSubtitleBlur}
                      placeholder="留空则使用站点描述"
                      className={`border-stone-200 text-sm h-8 ${savingKeys.has('site_hero_subtitle') ? 'opacity-60 pr-8' : ''}`}
                    />
                    {savingKeys.has('site_hero_subtitle') && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 其他站点配置 */}
        {otherConfigs.length > 0 && (
          <Card className="border-stone-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-stone-800">基础站点配置</CardTitle>
              <CardDescription>管理站点基础设置，修改后点击其他区域自动保存</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {otherConfigs.map((config) => {
                  const sensitive = isSensitive(config.key);
                  const revealed = revealedKeys.has(config.key);
                  const isSaving = savingKeys.has(config.key);
                  const currentValue = editValues[config.key] ?? config.value;
                  const isBoolean = isBooleanConfig(config.key, currentValue);
                  const isSelect = isSelectConfig(config.key);

                  return (
                    <div
                      key={config.id}
                      className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0 max-w-[50%]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-700">
                            {config.description || config.key}
                          </span>
                          {config.isEncrypted && (
                            <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-600">
                              加密
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5 font-mono">{config.key}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                        {isBoolean ? (
                          <>
                            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                            <Switch
                              checked={currentValue === 'true'}
                              onCheckedChange={async (checked) => {
                                const newValue = checked ? 'true' : 'false';
                                setEditValues((prev) => ({ ...prev, [config.key]: newValue }));
                                setSavingKeys((prev) => new Set(prev).add(config.key));
                                try {
                                  await configsApi.updateItem(config.key, newValue);
                                  toast.success('配置已更新');
                                  setConfigs((prev) =>
                                    prev.map((c) => (c.key === config.key ? { ...c, value: newValue } : c))
                                  );
                                } catch (err: unknown) {
                                  toast.error(err instanceof Error ? err.message : '更新失败');
                                  setEditValues((prev) => ({ ...prev, [config.key]: config.value }));
                                } finally {
                                  setSavingKeys((prev) => {
                                    const next = new Set(prev);
                                    next.delete(config.key);
                                    return next;
                                  });
                                }
                              }}
                            />
                            <span className="text-sm text-stone-500">{currentValue === 'true' ? '开启' : '关闭'}</span>
                          </>
                        ) : isSelect ? (
                          <>
                            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                            <Select
                              value={currentValue}
                              onValueChange={async (val) => {
                                setEditValues((prev) => ({ ...prev, [config.key]: val }));
                                setSavingKeys((prev) => new Set(prev).add(config.key));
                                try {
                                  await configsApi.updateItem(config.key, val);
                                  toast.success('配置已更新');
                                  setConfigs((prev) =>
                                    prev.map((c) => (c.key === config.key ? { ...c, value: val } : c))
                                  );
                                } catch (err: unknown) {
                                  toast.error(err instanceof Error ? err.message : '更新失败');
                                  setEditValues((prev) => ({ ...prev, [config.key]: config.value }));
                                } finally {
                                  setSavingKeys((prev) => {
                                    const next = new Set(prev);
                                    next.delete(config.key);
                                    return next;
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="border-stone-200 w-[160px] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SELECT_OPTIONS[config.key]?.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-stone-500">{getSelectLabel(config.key, currentValue)}</span>
                          </>
                        ) : (
                          <>
                            <div className="relative flex-1">
                              <Input
                                type={sensitive && !revealed ? 'password' : 'text'}
                                value={currentValue}
                                onChange={(e) => handleInlineChange(config.key, e.target.value)}
                                onBlur={() => handleInlineBlur(config)}
                                className={`border-stone-200 font-mono text-sm h-8 ${
                                  isSaving ? 'opacity-60 pr-8' : ''
                                }`}
                                placeholder="(空)"
                              />
                              {isSaving && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                                </div>
                              )}
                            </div>
                            {sensitive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => toggleReveal(config.key)}
                              >
                                {revealed ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // 存储配置专用渲染
  const renderStorageConfig = () => (
    <div className="space-y-6">
      {/* 存储模式选择 */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-stone-800">存储模式</CardTitle>
          <CardDescription>选择文件上传的存储方式，切换后新上传的文件将使用新模式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setStorageMode('local')}
              className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all ${
                storageMode === 'local'
                  ? 'border-amber-400 bg-amber-50 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <HardDrive className={`h-8 w-8 ${storageMode === 'local' ? 'text-amber-600' : 'text-stone-400'}`} />
              <div className="text-center">
                <p className={`text-sm font-semibold ${storageMode === 'local' ? 'text-amber-700' : 'text-stone-600'}`}>
                  本地存储
                </p>
                <p className="text-xs text-stone-400 mt-1">文件保存在服务器本地目录</p>
              </div>
              {storageMode === 'local' && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-5 w-5 text-amber-500" />
                </div>
              )}
            </button>

            <button
              onClick={() => setStorageMode('cos')}
              className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all ${
                storageMode === 'cos'
                  ? 'border-sky-400 bg-sky-50 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <Cloud className={`h-8 w-8 ${storageMode === 'cos' ? 'text-sky-600' : 'text-stone-400'}`} />
              <div className="text-center">
                <p className={`text-sm font-semibold ${storageMode === 'cos' ? 'text-sky-700' : 'text-stone-600'}`}>
                  腾讯云COS
                </p>
                <p className="text-xs text-stone-400 mt-1">文件上传到腾讯云对象存储</p>
              </div>
              {storageMode === 'cos' && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-5 w-5 text-sky-500" />
                </div>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 本地存储说明 */}
      {storageMode === 'local' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <HardDrive className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-stone-700 space-y-1">
                <p className="font-medium">本地存储模式</p>
                <p>文件将保存到服务器的 <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono">/uploads/works/</code> 目录。</p>
                <p className="text-stone-500">适合小型站点或自建服务器部署。如需使用CDN加速或对象存储，请切换到腾讯云COS模式。</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* COS配置表单 */}
      {storageMode === 'cos' && (
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-stone-800">腾讯云COS配置</CardTitle>
                <CardDescription>配置腾讯云对象存储参数，填写后请先测试连接再保存</CardDescription>
              </div>
              <Badge variant="outline" className={cosTestResult === 'success' ? 'border-emerald-200 text-emerald-700' : cosTestResult === 'fail' ? 'border-red-200 text-red-700' : 'border-stone-200 text-stone-500'}>
                {cosTestResult === 'success' ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" />已连接</>
                ) : cosTestResult === 'fail' ? (
                  <><XCircle className="h-3 w-3 mr-1" />连接失败</>
                ) : (
                  <>未测试</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>存储桶名称 (Bucket)</Label>
                <Input
                  value={cosBucket}
                  onChange={(e) => { setCosBucket(e.target.value); setCosTestResult('idle'); }}
                  placeholder="如: my-photo-1250000000"
                  className="border-stone-200"
                />
                <p className="text-xs text-stone-400">在COS控制台创建的存储桶名称</p>
              </div>
              <div className="space-y-2">
                <Label>区域 (Region)</Label>
                <Input
                  value={cosRegion}
                  onChange={(e) => { setCosRegion(e.target.value); setCosTestResult('idle'); }}
                  placeholder="如: ap-guangzhou"
                  className="border-stone-200"
                />
                <p className="text-xs text-stone-400">存储桶所在区域，如 ap-beijing、ap-shanghai</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>AppId</Label>
              <Input
                value={cosAppid}
                onChange={(e) => { setCosAppid(e.target.value); setCosTestResult('idle'); }}
                placeholder="如: 1250000000"
                className="border-stone-200 max-w-[300px]"
              />
              <p className="text-xs text-stone-400">腾讯云 AppId，即 Bucket 名称中短横线后面的数字部分</p>
            </div>

            <div className="space-y-2">
              <Label>CDN域名（可选）</Label>
              <Input
                value={cosCdnUrl}
                onChange={(e) => setCosCdnUrl(e.target.value)}
                placeholder="如: https://cdn.example.com"
                className="border-stone-200"
              />
              <p className="text-xs text-stone-400">绑定CDN加速域名后填写，留空则使用COS默认域名</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SecretId</Label>
                <Input
                  type="password"
                  value={cosSecretId}
                  onChange={(e) => { setCosSecretId(e.target.value); setCosTestResult('idle'); }}
                  placeholder="腾讯云API密钥SecretId"
                  className="border-stone-200 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>SecretKey</Label>
                <Input
                  type="password"
                  value={cosSecretKey}
                  onChange={(e) => { setCosSecretKey(e.target.value); setCosTestResult('idle'); }}
                  placeholder="腾讯云API密钥SecretKey"
                  className="border-stone-200 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>上传目录</Label>
              <Input
                value={cosUploadDir}
                onChange={(e) => setCosUploadDir(e.target.value)}
                placeholder="works"
                className="border-stone-200 max-w-[200px]"
              />
              <p className="text-xs text-stone-400">COS桶内的文件存放目录，默认 works</p>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleTestCos}
                disabled={cosTesting || !cosBucket || !cosRegion || !cosSecretId || !cosSecretKey}
                className="border-sky-200 text-sky-700 hover:bg-sky-50"
              >
                {cosTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 h-4 w-4" />
                )}
                测试连接
              </Button>
              <Button
                onClick={handleSaveStorage}
                disabled={cosSaving}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {cosSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                保存存储配置
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 当前模式也保存按钮 */}
      {storageMode === 'local' && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveStorage}
            disabled={cosSaving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {cosSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存存储配置
          </Button>
        </div>
      )}
    </div>
  );

  // 小程序配置专用渲染 (内联编辑，失焦自动保存)
  const renderMiniProgramConfig = () => (
    <div className="space-y-6">
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <Smartphone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-base text-stone-800">微信小程序配置</CardTitle>
              <CardDescription>配置小程序的 AppID 和 AppSecret，修改后失焦自动保存</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* AppID */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">小程序 AppID</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">miniprogram_appid</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={mpAppId}
                    onChange={(e) => setMpAppId(e.target.value)}
                    onBlur={handleMpAppIdBlur}
                    placeholder="如: wx1234567890abcdef"
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('miniprogram_appid') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('miniprogram_appid') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AppSecret */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">小程序 AppSecret</span>
                  <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-600">加密</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">miniprogram_appsecret</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    type="password"
                    value={mpAppSecret}
                    onChange={(e) => setMpAppSecret(e.target.value)}
                    onBlur={handleMpAppSecretBlur}
                    placeholder="小程序密钥，点击重置可获取"
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('miniprogram_appsecret') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('miniprogram_appsecret') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 小程序码版本 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">小程序码版本</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">miniprogram_env_version</p>
              </div>
              <div className="flex items-center gap-2">
                {savingKeys.has('miniprogram_env_version') && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                <Select value={mpEnvVersion} onValueChange={handleMpEnvVersionChange}>
                  <SelectTrigger className="border-stone-200 w-[160px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="develop">开发版</SelectItem>
                    <SelectItem value="trial">体验版</SelectItem>
                    <SelectItem value="release">正式版</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 小程序码跳转页面路径 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">小程序码跳转页面路径</span>
                  <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-600">重要</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">miniprogram_qrcode_page</p>
                <p className="text-[10px] text-stone-400 mt-1">扫码后跳转的页面路径，不含前导 /。若报 41030 错误，说明此页面在微信平台未发布，可改为首页路径后重新上传小程序</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={mpQrcodePage}
                    onChange={(e) => setMpQrcodePage(e.target.value)}
                    onBlur={handleMpQrcodePageBlur}
                    placeholder="pages/detail/detail"
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('miniprogram_qrcode_page') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('miniprogram_qrcode_page') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Access Token 缓存有效期 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">Access Token 缓存有效期</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">miniprogram_access_token_ttl</p>
                <p className="text-[10px] text-stone-400 mt-1">微信官方有效期 7200 秒，建议设为 6900（提前 5 分钟刷新）</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1 max-w-[200px]">
                  <Input
                    type="number"
                    value={mpAccessTokenTtl}
                    onChange={(e) => setMpAccessTokenTtl(e.target.value)}
                    onBlur={handleMpAccessTokenTtlBlur}
                    placeholder="6900"
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('miniprogram_access_token_ttl') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('miniprogram_access_token_ttl') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                  <span className="text-xs text-stone-400 ml-2">秒</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 配置说明 */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-stone-700 space-y-1">
              <p className="font-medium">配置说明</p>
              <p>1. 登录 <a href="https://mp.weixin.qq.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">微信公众平台</a>，进入「开发管理 → 开发设置」</p>
              <p>2. 复制 AppID 填写到上方输入框，点击其他区域自动保存</p>
              <p>3. 点击 AppSecret 旁边的「重置」按钮，获取密钥并填写</p>
              <p>4. 选择小程序码版本：小程序未发布选「体验版」，已上线选「正式版」</p>
              <p>5. 小程序码跳转页面路径需与微信平台已发布的页面一致，若报 41030 错误，说明该页面未在小程序中发布，可改为 pages/index/index 后重新上传小程序</p>
              <p>6. 系统已内置智能降级：若配置的页面路径无效，会自动降级为首页路径生成二维码</p>
              <p>7. 配置完成后，小程序端即可使用微信登录和二维码分享功能</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 高德地图配置专用渲染 (内联编辑，失焦自动保存 + 测试按钮)
  const renderAmapConfig = () => (
    <div className="space-y-6">
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base text-stone-800">高德地图配置</CardTitle>
                <CardDescription>配置高德地图API Key，用于作品定位和城市识别，修改后失焦自动保存</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={amapTestResult === 'success' ? 'border-emerald-200 text-emerald-700' : amapTestResult === 'fail' ? 'border-red-200 text-red-700' : 'border-stone-200 text-stone-500'}>
              {amapTestResult === 'success' ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />正常</>
              ) : amapTestResult === 'fail' ? (
                <><XCircle className="h-3 w-3 mr-1" />异常</>
              ) : (
                <>未测试</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Web服务 API Key */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">Web服务 API Key</span>
                  <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-600">加密</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">amap_api_key</p>
                <p className="text-[10px] text-stone-400 mt-1">用于服务端反向地理编码，添加Key时服务平台选择「Web服务」</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    type="password"
                    value={amapApiKey}
                    onChange={(e) => { setAmapApiKey(e.target.value); setAmapTestResult('idle'); }}
                    onBlur={handleAmapApiKeyBlur}
                    placeholder="高德Web服务API Key"
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('amap_api_key') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('amap_api_key') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* JS API Key */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">JS API Key (前端)</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">amap_js_key</p>
                <p className="text-[10px] text-stone-400 mt-1">用于前端地图展示，添加Key时服务平台选择「Web端(JS API)」</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={amapJsKey}
                    onChange={(e) => { setAmapJsKey(e.target.value); setAmapTestResult('idle'); }}
                    onBlur={handleAmapJsKeyBlur}
                    placeholder="高德JS API Key（用于前端地图展示）"
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('amap_js_key') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('amap_js_key') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 安全密钥 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">安全密钥</span>
                  <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-600">加密</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">amap_security_key</p>
                <p className="text-[10px] text-stone-400 mt-1">JS API 2.0 必须配置安全密钥，在高德控制台对应Key的「安全密钥」栏获取</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    type="password"
                    value={amapSecurityKey}
                    onChange={(e) => { setAmapSecurityKey(e.target.value); setAmapTestResult('idle'); }}
                    onBlur={handleAmapSecurityKeyBlur}
                    placeholder="安全密钥（JS API 2.0必需）"
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('amap_security_key') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('amap_security_key') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTestAmap}
              disabled={amapTesting || !amapApiKey}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              {amapTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plug className="mr-2 h-4 w-4" />
              )}
              测试配置
            </Button>
            <span className="text-xs text-stone-400">测试Web服务API Key是否有效，验证反向地理编码功能是否正常</span>
          </div>
        </CardContent>
      </Card>

      {/* 配置说明 */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-stone-700 space-y-1">
              <p className="font-medium">配置说明</p>
              <p>1. 登录 <a href="https://console.amap.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">高德开放平台</a>，注册并创建应用</p>
              <p>2. 添加 Key，服务平台选择「Web服务」，获取 Web服务 API Key（用于服务端反向地理编码）</p>
              <p>3. 再添加一个 Key，服务平台选择「Web端(JS API)」，获取 JS API Key（用于前端地图展示）</p>
              <p>4. 在 JS API Key 的设置中，点击「安全密钥」获取安全密钥，填入上方「安全密钥」输入框</p>
              <p>5. 将三个 Key 分别填入上方对应输入框，点击其他区域自动保存</p>
              <p>6. 点击「测试配置」按钮，验证 Web服务 API Key 是否有效</p>
              <p>7. 配置完成后，作品管理页面可使用高德API进行GPS定位和城市识别</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 缓存配置内联自动保存
  const handleCacheFieldSave = async (key: string, value: string) => {
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      await configsApi.updateItem(key, value);
      toast.success('配置已更新');
      setConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleCacheEnabledChange = async (val: boolean) => {
    setCacheEnabled(val);
    await handleCacheFieldSave('cache_enabled', val ? 'true' : 'false');
  };

  const handleCacheTtlBlur = async () => {
    if (cacheTtl !== (configs.find((c) => c.key === 'cache_ttl')?.value || '300')) {
      await handleCacheFieldSave('cache_ttl', cacheTtl);
    }
  };

  const handleRedisHostBlur = async () => {
    const orig = configs.find((c) => c.key === 'redis_host')?.value || '';
    if (redisHost !== orig) {
      await handleCacheFieldSave('redis_host', redisHost);
    }
  };

  const handleRedisPortBlur = async () => {
    const orig = configs.find((c) => c.key === 'redis_port')?.value || '6379';
    if (redisPort !== orig) {
      await handleCacheFieldSave('redis_port', redisPort);
    }
  };

  const handleRedisPasswordBlur = async () => {
    const orig = configs.find((c) => c.key === 'redis_password')?.value || '';
    if (redisPassword !== orig) {
      await handleCacheFieldSave('redis_password', redisPassword);
    }
  };

  const handleRedisDbChange = async (val: string) => {
    setRedisDb(val);
    await handleCacheFieldSave('redis_db', val);
  };

  // 关于页面配置专用渲染
  const renderAboutConfig = () => (
    <div className="space-y-6">
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
              <Type className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base text-stone-800">关于页面配置</CardTitle>
              <CardDescription>配置关于页面的标签、标题、内容和历程，修改后失焦自动保存</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* 标签文字 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">标签文字</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">about_eyebrow</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={aboutEyebrow}
                    onChange={(e) => setAboutEyebrow(e.target.value)}
                    onBlur={handleAboutEyebrowBlur}
                    placeholder="致每一位摄影者"
                    className={`border-stone-200 text-sm h-8 ${savingKeys.has('about_eyebrow') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('about_eyebrow') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 标题 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <Type className="h-3.5 w-3.5 text-stone-400" />
                  <span className="text-sm font-medium text-stone-700">页面标题</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">about_title · 用*包裹的文字显示为斜体</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={aboutTitle}
                    onChange={(e) => setAboutTitle(e.target.value)}
                    onBlur={handleAboutTitleBlur}
                    placeholder="致每一位*追光者*"
                    className={`border-stone-200 text-sm h-8 ${savingKeys.has('about_title') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('about_title') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 正文内容 (Markdown) */}
            <div className="rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-stone-700">正文内容</span>
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-600">Markdown</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5 font-mono mb-2">about_content · 支持Markdown语法，显示在标题下方</p>
              <textarea
                value={aboutContent}
                onChange={(e) => setAboutContent(e.target.value)}
                onBlur={handleAboutContentBlur}
                rows={10}
                placeholder={"每一帧画面，都是时间赠予的礼物。\n\n我们相信，光影之间藏着最真实的故事。\n\n- 支持 **粗体** 和 *斜体*\n- 支持 [链接](url)\n- 支持列表和引用"}
                className={`w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-y font-mono leading-relaxed ${savingKeys.has('about_content') ? 'opacity-60' : ''}`}
              />
              {savingKeys.has('about_content') && (
                <div className="flex items-center gap-1 mt-1 text-stone-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-[10px]">保存中...</span>
                </div>
              )}
              <p className="text-[10px] text-stone-400 mt-1.5">支持 Markdown 语法：**粗体** *斜体* [链接](url) - 列表 &gt; 引用 等</p>
            </div>

            {/* 历程数据 */}
            <div className="rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">历程时间线</span>
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-600">表单</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMilestone}
                  className="h-7 text-xs gap-1 border-violet-200 text-violet-600 hover:bg-violet-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加阶段
                </Button>
              </div>
              <p className="text-xs text-stone-400 font-mono mb-3">about_milestones · 拖动或使用箭头调整顺序，点击保存按钮提交修改</p>

              <div className="space-y-3">
                {aboutMilestones.map((ms, index) => (
                  <div
                    key={index}
                    className="relative rounded-lg border border-stone-200 bg-white p-4 group hover:border-violet-200 transition-colors"
                  >
                    {/* 顶部：序号 + 操作按钮 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="text-xs text-stone-400 font-mono">第 {index + 1} 阶段</span>
                        {ms.active && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-600">当前阶段</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveMilestone(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="上移"
                        >
                          <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveMilestone(index, 'down')}
                          disabled={index === aboutMilestones.length - 1}
                          className="p-1 rounded hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="下移"
                        >
                          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(index)}
                          className="p-1 rounded hover:bg-red-50 transition-colors"
                          title="删除此阶段"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-stone-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>

                    {/* 表单字段 */}
                    <div className="grid grid-cols-[120px_1fr] gap-3">
                      <div>
                        <Label className="text-xs text-stone-500 mb-1">阶段编号</Label>
                        <Input
                          value={ms.phase}
                          onChange={(e) => handleMilestoneChange(index, 'phase', e.target.value)}
                          placeholder="PHASE 01"
                          className="border-stone-200 text-sm h-8 font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-stone-500 mb-1">阶段标题</Label>
                        <Input
                          value={ms.title}
                          onChange={(e) => handleMilestoneChange(index, 'title', e.target.value)}
                          placeholder="灵感萌发"
                          className="border-stone-200 text-sm h-8"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <Label className="text-xs text-stone-500 mb-1">阶段描述</Label>
                      <textarea
                        value={ms.desc}
                        onChange={(e) => handleMilestoneChange(index, 'desc', e.target.value)}
                        placeholder="描述这一阶段的故事..."
                        rows={2}
                        className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-y leading-relaxed"
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Switch
                        checked={!!ms.active}
                        onCheckedChange={(checked) => handleMilestoneChange(index, 'active', checked)}
                      />
                      <span className="text-xs text-stone-500">标记为当前阶段（高亮显示）</span>
                    </div>
                  </div>
                ))}

                {aboutMilestones.length === 0 && (
                  <div className="text-center py-6 text-sm text-stone-400">
                    暂无历程阶段，点击上方「添加阶段」开始添加
                  </div>
                )}
              </div>

              {/* 保存按钮 */}
              {aboutMilestones.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleAboutMilestonesSave}
                    disabled={savingKeys.has('about_milestones') || savingKeys.has('about_features')}
                    className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {savingKeys.has('about_milestones') || savingKeys.has('about_features') ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    保存历程与特色功能
                  </Button>
                  <span className="text-[10px] text-stone-400">历程和特色功能修改后统一保存</span>
                </div>
              )}

              {/* ========== 特色功能卡片编辑区 ========== */}
              <div className="mt-8 pt-6 border-t border-stone-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-700">特色功能卡片</span>
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-600">表单</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAboutFeatures((prev) => [...prev, { icon: 'Star', color: 'amber', title: '', content: '', english: '' }])}
                    className="h-7 text-xs gap-1 border-violet-200 text-violet-600 hover:bg-violet-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加卡片
                  </Button>
                </div>
                <p className="text-xs text-stone-400 font-mono mb-3">about_features · 自定义图标、颜色、标题、内容和英文，点击保存按钮提交修改</p>

                <div className="space-y-4">
                  {aboutFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className="relative rounded-lg border border-stone-200 bg-white p-4 group hover:border-violet-200 transition-colors"
                    >
                      {/* 顶部：序号 + 操作 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="text-xs text-stone-400">卡片 {index + 1}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAboutFeatures((prev) => prev.filter((_, i) => i !== index))}
                          className="p-1 rounded hover:bg-red-50 transition-colors"
                          title="删除此卡片"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-stone-400 hover:text-red-500" />
                        </button>
                      </div>

                      {/* 图标选择 + 颜色选择 */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs text-stone-500 mb-1">图标</Label>
                          <IconPicker
                            value={feature.icon}
                            color={feature.color}
                            onChange={(val) => {
                              setAboutFeatures((prev) => prev.map((f, i) => i === index ? { ...f, icon: val } : f));
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-stone-500 mb-1">颜色</Label>
                          <div className="flex gap-1.5 flex-wrap">
                            {FEATURE_COLORS.map((c) => {
                              const colorBtnMap: Record<string, string> = {
                                amber: 'bg-amber-500',
                                rose: 'bg-rose-500',
                                emerald: 'bg-emerald-500',
                                blue: 'bg-blue-500',
                                violet: 'bg-violet-500',
                                orange: 'bg-orange-500',
                                cyan: 'bg-cyan-500',
                                pink: 'bg-pink-500',
                              };
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setAboutFeatures((prev) => prev.map((f, i) => i === index ? { ...f, color: c } : f))}
                                  className={`w-6 h-6 rounded-full ${colorBtnMap[c]} ${feature.color === c ? 'ring-2 ring-offset-1 ring-violet-500' : ''} hover:scale-110 transition-transform`}
                                  title={c}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 标题 + 英文 */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs text-stone-500 mb-1">标题</Label>
                          <Input
                            value={feature.title}
                            onChange={(e) => setAboutFeatures((prev) => prev.map((f, i) => i === index ? { ...f, title: e.target.value } : f))}
                            placeholder="精选作品"
                            className="border-stone-200 text-sm h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-stone-500 mb-1">英文标注</Label>
                          <Input
                            value={feature.english}
                            onChange={(e) => setAboutFeatures((prev) => prev.map((f, i) => i === index ? { ...f, english: e.target.value } : f))}
                            placeholder="Curated Gallery"
                            className="border-stone-200 text-sm h-8 font-mono"
                          />
                        </div>
                      </div>

                      {/* 内容 */}
                      <div>
                        <Label className="text-xs text-stone-500 mb-1">描述内容</Label>
                        <textarea
                          value={feature.content}
                          onChange={(e) => setAboutFeatures((prev) => prev.map((f, i) => i === index ? { ...f, content: e.target.value } : f))}
                          placeholder="精心策展的摄影作品集..."
                          rows={2}
                          className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-y"
                        />
                      </div>
                    </div>
                  ))}

                  {aboutFeatures.length === 0 && (
                    <div className="text-center py-6 text-sm text-stone-400">
                      暂无特色功能卡片，点击上方「添加卡片」开始添加
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 聚合登录配置专用渲染
  const ALL_SOCIAL_PROVIDERS = [
    { key: 'qq', name: 'QQ' },
    { key: 'wx', name: '微信' },
    { key: 'alipay', name: '支付宝' },
    { key: 'sina', name: '微博' },
    { key: 'baidu', name: '百度' },
    { key: 'douyin', name: '抖音' },
    { key: 'huawei', name: '华为' },
    { key: 'xiaomi', name: '小米' },
    { key: 'google', name: 'Google' },
    { key: 'microsoft', name: 'Microsoft' },
    { key: 'facebook', name: 'Facebook' },
    { key: 'twitter', name: 'Twitter' },
    { key: 'feishu', name: '飞书' },
    { key: 'wework', name: '企业微信' },
    { key: 'dingtalk', name: '钉钉' },
    { key: 'gitee', name: 'Gitee' },
    { key: 'github', name: 'GitHub' },
  ];

  const toggleSocialProvider = async (key: string) => {
    const newProviders = socialLoginProviders.includes(key)
      ? socialLoginProviders.filter((p) => p !== key)
      : [...socialLoginProviders, key];
    setSocialLoginProviders(newProviders);
    await handleCacheFieldSave('social_login_providers', JSON.stringify(newProviders));
  };

  const renderSocialLoginConfig = () => (
    <div className="space-y-6">
      {/* 功能开关 */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Plug className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base text-stone-800">华年聚合登录</CardTitle>
              <CardDescription>集成第三方快捷登录（QQ、微信、微博等），修改后自动保存</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 开关 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">启用聚合登录</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">social_login_enabled</p>
              </div>
              <div className="flex items-center gap-2">
                {savingKeys.has('social_login_enabled') && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                <Switch
                  checked={socialLoginEnabled}
                  onCheckedChange={async (val) => {
                    setSocialLoginEnabled(val);
                    await handleCacheFieldSave('social_login_enabled', val ? 'true' : 'false');
                  }}
                />
                <span className="text-sm text-stone-500">{socialLoginEnabled ? '开启' : '关闭'}</span>
              </div>
            </div>

            {/* AppID */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">AppID</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">social_login_appid · 华年聚合登录分配的应用ID</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={socialLoginAppid}
                    onChange={(e) => setSocialLoginAppid(e.target.value)}
                    onBlur={async () => {
                      const orig = configs.find((c) => c.key === 'social_login_appid')?.value || '';
                      if (socialLoginAppid !== orig) await handleCacheFieldSave('social_login_appid', socialLoginAppid);
                    }}
                    placeholder="请输入AppID"
                    className="border-stone-200 text-sm h-8"
                  />
                </div>
              </div>
            </div>

            {/* AppKey */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">AppKey</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">social_login_appkey · 华年聚合登录分配的应用密钥</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    type={revealedKeys.has('social_login_appkey') ? 'text' : 'password'}
                    value={socialLoginAppkey}
                    onChange={(e) => setSocialLoginAppkey(e.target.value)}
                    onBlur={async () => {
                      const orig = configs.find((c) => c.key === 'social_login_appkey')?.value || '';
                      if (socialLoginAppkey && socialLoginAppkey !== orig) await handleCacheFieldSave('social_login_appkey', socialLoginAppkey);
                    }}
                    placeholder="请输入AppKey"
                    className="border-stone-200 text-sm h-8 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => toggleReveal('social_login_appkey')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {revealedKeys.has('social_login_appkey') ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* 回调地址 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">回调地址</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">social_login_redirect_uri · 登录成功后跳转的页面地址</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    value={socialLoginRedirectUri}
                    onChange={(e) => setSocialLoginRedirectUri(e.target.value)}
                    onBlur={async () => {
                      const orig = configs.find((c) => c.key === 'social_login_redirect_uri')?.value || '';
                      if (socialLoginRedirectUri !== orig) await handleCacheFieldSave('social_login_redirect_uri', socialLoginRedirectUri);
                    }}
                    placeholder="https://yoursite.com/auth/callback"
                    className="border-stone-200 text-sm h-8"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 登录方式选择 */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-stone-800">登录方式</CardTitle>
          <CardDescription>选择要启用的第三方登录方式，勾选即启用，取消勾选即禁用</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {ALL_SOCIAL_PROVIDERS.map((provider) => {
              const isSelected = socialLoginProviders.includes(provider.key);
              return (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => toggleSocialProvider(provider.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-primary border-primary' : 'border-stone-300'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  {provider.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 配置说明 */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Plug className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
            <div className="text-sm text-stone-700 space-y-1">
              <p className="font-medium">配置说明</p>
              <p>1. 前往 <a href="https://login.cxwa.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">华年聚合登录</a> 注册并创建应用，获取 AppID 和 AppKey</p>
              <p>2. 回调地址填写格式：https://你的域名/auth/callback</p>
              <p>3. 在华年后台的回调地址必须与这里填写的一致</p>
              <p>4. 勾选需要的登录方式，前端登录页将只显示已勾选的方式</p>
              <p>5. 首次使用第三方登录的用户会自动注册账号</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 缓存配置专用渲染 (内联编辑，失焦/切换自动保存)
  const renderCacheConfig = () => (
    <div className="space-y-6">
      {/* 基础配置 */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-stone-800">基础配置</CardTitle>
          <CardDescription>修改后自动保存，无需手动点击保存按钮</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* 缓存开关 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">缓存开关</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">cache_enabled</p>
              </div>
              <div className="flex items-center gap-2">
                {savingKeys.has('cache_enabled') && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                <Switch checked={cacheEnabled} onCheckedChange={handleCacheEnabledChange} />
                <span className="text-sm text-stone-500">{cacheEnabled ? '开启' : '关闭'}</span>
              </div>
            </div>

            {/* 缓存类型 - 固定为Redis */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">缓存类型</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">cache_type</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-sky-200 text-sky-700 bg-sky-50">Redis</Badge>
              </div>
            </div>

            {/* 类型说明 */}
            <div className="px-4 pb-2">
              <p className="text-xs text-stone-400">
                使用Redis服务存储，支持持久化和分布式，适合生产环境
              </p>
            </div>

            {/* 默认TTL */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">默认TTL (秒)</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">cache_ttl</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    value={cacheTtl}
                    onChange={(e) => setCacheTtl(e.target.value)}
                    onBlur={handleCacheTtlBlur}
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('cache_ttl') ? 'opacity-60 pr-8' : ''}`}
                    placeholder="300"
                  />
                  {savingKeys.has('cache_ttl') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redis连接配置 */}
      <Card className="border-stone-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-stone-800">Redis连接配置</CardTitle>
          <CardDescription>修改后自动保存，无需手动点击保存按钮</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Redis地址 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">Redis地址</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">redis_host</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    placeholder="如: 127.0.0.1"
                    value={redisHost}
                    onChange={(e) => setRedisHost(e.target.value)}
                    onBlur={handleRedisHostBlur}
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('redis_host') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('redis_host') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Redis端口 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">Redis端口</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">redis_port</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    placeholder="6379"
                    value={redisPort}
                    onChange={(e) => setRedisPort(e.target.value)}
                    onBlur={handleRedisPortBlur}
                    className={`border-stone-200 font-mono text-sm h-8 w-28 ${savingKeys.has('redis_port') ? 'opacity-60 pr-8' : ''}`}
                  />
                  {savingKeys.has('redis_port') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Redis密码 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">Redis密码</span>
                  <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-600">加密</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">redis_password</p>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                <div className="relative flex-1">
                  <Input
                    type="password"
                    placeholder="留空则无密码"
                    value={redisPassword}
                    onChange={(e) => setRedisPassword(e.target.value)}
                    onBlur={handleRedisPasswordBlur}
                    className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('redis_password') ? 'opacity-60 pr-8' : ''}`}
                    
                  />
                  {savingKeys.has('redis_password') && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Redis数据库编号 */}
            <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex-1 min-w-0 max-w-[50%]">
                <span className="text-sm font-medium text-stone-700">Redis数据库编号</span>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">redis_db</p>
              </div>
              <div className="flex items-center gap-2">
                {savingKeys.has('redis_db') && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                <Select value={redisDb} onValueChange={handleRedisDbChange} >
                  <SelectTrigger className="border-stone-200 font-mono w-28 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 16 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>数据库 {i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ========== 安全配置辅助函数 ==========

  // 复制到剪贴板
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success('已复制到剪贴板'),
      () => toast.error('复制失败')
    );
  };

  // 保存安全配置总开关
  const handleAccessControlChange = async (val: boolean) => {
    setAccessControlEnabled(val);
    await handleCacheFieldSave('security_access_control_enabled', val ? 'true' : 'false');
  };

  // 保存免验证路径开关
  const handleSkipPublicGetChange = async (val: boolean) => {
    setSkipPublicGet(val);
    await handleCacheFieldSave('security_skip_public_get', val ? 'true' : 'false');
  };

  const handleSkipAuthPathsChange = async (val: boolean) => {
    setSkipAuthPaths(val);
    await handleCacheFieldSave('security_skip_auth_paths', val ? 'true' : 'false');
  };

  // 保存时间戳容差
  const handleTimestampToleranceBlur = async () => {
    const orig = configs.find((c) => c.key === 'security_timestamp_tolerance')?.value || '300';
    if (timestampTolerance !== orig) {
      await handleCacheFieldSave('security_timestamp_tolerance', timestampTolerance);
    }
  };

  // 保存小程序签名密钥有效期
  const handleSignKeyTtlBlur = async () => {
    const orig = configs.find((c) => c.key === 'security_signkey_ttl')?.value || '86400';
    if (signKeyTtl !== orig) {
      await handleCacheFieldSave('security_signkey_ttl', signKeyTtl);
    }
  };

  // 保存域名白名单
  const handleAllowedOriginsBlur = async () => {
    const orig = configs.find((c) => c.key === 'security_allowed_origins')?.value || '[]';
    const newVal = JSON.stringify(allowedOrigins.split('\n').map(s => s.trim()).filter(Boolean));
    if (newVal !== orig) {
      await handleCacheFieldSave('security_allowed_origins', newVal);
    }
  };

  // 保存客户端凭证（JSON 数组）
  const handleSaveApiClients = async () => {
    setSecuritySaving(true);
    try {
      await configsApi.updateItem('security_api_keys', JSON.stringify(apiClients));
      toast.success('客户端凭证已保存');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSecuritySaving(false);
    }
  };

  // 重置某个客户端的密钥
  const handleResetSecret = (index: number) => {
    setApiClients(prev => {
      const next = [...prev];
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      const array = new Uint8Array(48);
      crypto.getRandomValues(array);
      const secret = Array.from(array, byte => chars[byte % chars.length]).join('');
      next[index] = { ...next[index], appSecret: secret };
      return next;
    });
    toast.success('密钥已重置，请点击「保存凭证」生效');
  };

  // 切换客户端启用状态
  const handleToggleClient = (index: number) => {
    setApiClients(prev => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      return next;
    });
  };

  // 添加新客户端
  const handleAddClient = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const genId = () => {
      const array = new Uint8Array(8);
      crypto.getRandomValues(array);
      return Array.from(array, byte => chars[byte % 26].toLowerCase()).join('');
    };
    const genSecret = () => {
      const array = new Uint8Array(48);
      crypto.getRandomValues(array);
      return Array.from(array, byte => chars[byte % chars.length]).join('');
    };
    setApiClients(prev => [...prev, {
      appId: `gyj_${genId()}`,
      appSecret: genSecret(),
      name: '新客户端',
      clientType: 'web',
      enabled: true,
    }]);
    toast.success('已添加新客户端，请修改名称后保存');
  };

  // 删除客户端
  const handleRemoveClient = (index: number) => {
    setApiClients(prev => prev.filter((_, i) => i !== index));
    toast.success('客户端已移除，请点击「保存凭证」生效');
  };

  // ========== 安全配置专用渲染 ==========
  const renderSecurityConfig = () => {
    const CLIENT_TYPE_MAP: Record<string, { label: string; color: string }> = {
      web: { label: '网站', color: 'bg-sky-100 text-sky-700' },
      miniprogram: { label: '小程序', color: 'bg-green-100 text-green-700' },
      admin: { label: '管理后台', color: 'bg-amber-100 text-amber-700' },
    };

    // 安全组中已有的通用配置（限流等），排除自定义字段
    const customSecurityKeys = new Set([
      'security_access_control_enabled',
      'security_skip_public_get',
      'security_skip_auth_paths',
      'security_timestamp_tolerance',
      'security_api_keys',
      'security_allowed_origins',
      'security_signkey_ttl',
    ]);
    const genericSecurityConfigs = configs.filter((c) => !customSecurityKeys.has(c.key));

    return (
      <div className="space-y-6">
        {/* Section A: 总开关 - 接口访问控制 */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base text-stone-800">接口访问控制</CardTitle>
                <CardDescription>开启后，所有 API 接口需要通过 API Key + 签名验证才能访问（公开接口除外）</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0 max-w-[50%]">
                  <span className="text-sm font-medium text-stone-700">启用访问控制</span>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">security_access_control_enabled</p>
                </div>
                <div className="flex items-center gap-2">
                  {savingKeys.has('security_access_control_enabled') && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                  <Switch checked={accessControlEnabled} onCheckedChange={handleAccessControlChange} />
                  <span className="text-sm text-stone-500">{accessControlEnabled ? '开启' : '关闭'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section B: 客户端凭证管理 */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                <Smartphone className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base text-stone-800">客户端凭证</CardTitle>
                <CardDescription>管理各端（网站、小程序、管理后台）的 API 凭证，修改后需点击保存按钮</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddClient}
                className="h-7 text-xs gap-1 border-violet-200 text-violet-600 hover:bg-violet-50"
              >
                <Plus className="h-3.5 w-3.5" />
                添加客户端
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {apiClients.length === 0 ? (
                <div className="text-center py-6 text-sm text-stone-400">
                  暂无客户端凭证，点击上方「添加客户端」开始添加
                </div>
              ) : (
                apiClients.map((client, index) => {
                  const typeInfo = CLIENT_TYPE_MAP[client.clientType] || CLIENT_TYPE_MAP.web;
                  return (
                    <div
                      key={`${client.appId}-${index}`}
                      className="relative rounded-lg border border-stone-200 bg-white p-4 hover:border-violet-200 transition-colors"
                    >
                      {/* 顶部：客户端名称 + 类型 + 操作 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                            {index + 1}
                          </span>
                          <Input
                            value={client.name}
                            onChange={(e) => setApiClients(prev => prev.map((c, i) => i === index ? { ...c, name: e.target.value } : c))}
                            className="border-stone-200 text-sm h-7 max-w-[200px] font-medium"
                            placeholder="客户端名称"
                          />
                          <Badge variant="outline" className={`${typeInfo.color} text-[10px] px-2 py-0.5`}>
                            {typeInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <select
                            value={client.clientType}
                            onChange={(e) => setApiClients(prev => prev.map((c, i) => i === index ? { ...c, clientType: e.target.value as ClientCredentialItem['clientType'] } : c))}
                            className="text-xs border border-stone-200 rounded-md px-2 py-1 bg-white text-stone-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                          >
                            <option value="web">网站</option>
                            <option value="miniprogram">小程序</option>
                            <option value="admin">管理后台</option>
                          </select>
                          <Switch
                            checked={client.enabled}
                            onCheckedChange={() => handleToggleClient(index)}
                            className="ml-2"
                          />
                          <span className="text-[10px] text-stone-400 ml-1">{client.enabled ? '启用' : '禁用'}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveClient(index)}
                            className="p-1 rounded hover:bg-red-50 transition-colors ml-1"
                            title="删除此客户端"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-stone-400 hover:text-red-500" />
                          </button>
                        </div>
                      </div>

                      {/* App ID */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-stone-500 shrink-0 w-16">App ID</Label>
                          <div className="relative flex-1">
                            <Input
                              value={client.appId}
                              readOnly
                              className="border-stone-200 text-sm h-7 font-mono bg-stone-50 cursor-default pr-8"
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(client.appId)}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-200 transition-colors"
                              title="复制 App ID"
                            >
                              <Copy className="h-3 w-3 text-stone-400" />
                            </button>
                          </div>
                        </div>

                        {/* App Secret */}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-stone-500 shrink-0 w-16">App Secret</Label>
                          <div className="relative flex-1">
                            <Input
                              type={revealedKeys.has(`client_${index}`) ? 'text' : 'password'}
                              value={client.appSecret}
                              readOnly
                              className="border-stone-200 text-sm h-7 font-mono bg-stone-50 cursor-default pr-16"
                            />
                            <button
                              type="button"
                              onClick={() => toggleReveal(`client_${index}`)}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-200 transition-colors"
                              title={revealedKeys.has(`client_${index}`) ? '隐藏密钥' : '显示密钥'}
                            >
                              {revealedKeys.has(`client_${index}`) ? (
                                <EyeOff className="h-3 w-3 text-stone-400" />
                              ) : (
                                <Eye className="h-3 w-3 text-stone-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(client.appSecret)}
                              className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-stone-200 transition-colors"
                              title="复制密钥"
                            >
                              <Copy className="h-3 w-3 text-stone-400" />
                            </button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetSecret(index)}
                            className="h-7 text-xs gap-1 border-amber-200 text-amber-600 hover:bg-amber-50 shrink-0"
                          >
                            <RefreshCw className="h-3 w-3" />
                            重置密钥
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* 保存凭证按钮 */}
              {apiClients.length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleSaveApiClients}
                    disabled={securitySaving}
                    className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {securitySaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    保存凭证
                  </Button>
                  <span className="text-[10px] text-stone-400">凭证修改后需点击保存才能生效</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section C: 域名白名单 */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
                <Globe className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <CardTitle className="text-base text-stone-800">域名白名单</CardTitle>
                <CardDescription>配置允许跨域请求的域名列表，每行一个域名，修改后失焦自动保存</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-stone-700">允许的域名</span>
                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-600">多行</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5 font-mono mb-2">security_allowed_origins · 小程序请求无 Origin，仅通过 API Key 验证</p>
              <textarea
                value={allowedOrigins}
                onChange={(e) => setAllowedOrigins(e.target.value)}
                onBlur={handleAllowedOriginsBlur}
                rows={4}
                placeholder={"https://example.com\nhttps://admin.example.com"}
                className={`w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 resize-y font-mono leading-relaxed ${savingKeys.has('security_allowed_origins') ? 'opacity-60' : ''}`}
              />
              {savingKeys.has('security_allowed_origins') && (
                <div className="flex items-center gap-1 mt-1 text-stone-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-[10px]">保存中...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section D: 免验证路径 + 时间戳容差 */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base text-stone-800">免验证路径与时间戳</CardTitle>
                <CardDescription>配置不需要 API Key 验证的接口路径及签名容差，修改后自动保存</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* 公开GET接口免验证 */}
              <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0 max-w-[50%]">
                  <span className="text-sm font-medium text-stone-700">公开 GET 接口免验证</span>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">security_skip_public_get · SEO 爬虫和前端页面可直接访问</p>
                </div>
                <div className="flex items-center gap-2">
                  {savingKeys.has('security_skip_public_get') && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                  <Switch checked={skipPublicGet} onCheckedChange={handleSkipPublicGetChange} />
                  <span className="text-sm text-stone-500">{skipPublicGet ? '开启' : '关闭'}</span>
                </div>
              </div>

              {/* 登录注册接口免验证 */}
              <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0 max-w-[50%]">
                  <span className="text-sm font-medium text-stone-700">登录注册接口免验证</span>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">security_skip_auth_paths · /api/auth 路径不需要签名验证</p>
                </div>
                <div className="flex items-center gap-2">
                  {savingKeys.has('security_skip_auth_paths') && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                  <Switch checked={skipAuthPaths} onCheckedChange={handleSkipAuthPathsChange} />
                  <span className="text-sm text-stone-500">{skipAuthPaths ? '开启' : '关闭'}</span>
                </div>
              </div>

              {/* 时间戳容差 */}
              <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0 max-w-[50%]">
                  <span className="text-sm font-medium text-stone-700">时间戳容差</span>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">security_timestamp_tolerance · 请求时间戳与服务器时间的最大允许偏差</p>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                  <div className="relative flex-1 max-w-[200px]">
                    <Input
                      type="number"
                      value={timestampTolerance}
                      onChange={(e) => setTimestampTolerance(e.target.value)}
                      onBlur={handleTimestampToleranceBlur}
                      placeholder="300"
                      className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('security_timestamp_tolerance') ? 'opacity-60 pr-8' : ''}`}
                    />
                    {savingKeys.has('security_timestamp_tolerance') && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                      </div>
                    )}
                    <span className="text-xs text-stone-400 ml-2">秒</span>
                  </div>
                </div>
              </div>

              {/* 小程序签名密钥有效期 */}
              <div className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0 max-w-[50%]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-700">小程序签名密钥有效期</span>
                    <Badge variant="outline" className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5">小程序</Badge>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">security_signkey_ttl · 小程序登录后签发的临时签名密钥有效期，过期需重新登录</p>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                  <div className="relative flex-1 max-w-[200px]">
                    <Input
                      type="number"
                      value={signKeyTtl}
                      onChange={(e) => setSignKeyTtl(e.target.value)}
                      onBlur={handleSignKeyTtlBlur}
                      placeholder="86400"
                      className={`border-stone-200 font-mono text-sm h-8 ${savingKeys.has('security_signkey_ttl') ? 'opacity-60 pr-8' : ''}`}
                    />
                    {savingKeys.has('security_signkey_ttl') && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                      </div>
                    )}
                    <span className="text-xs text-stone-400 ml-2 shrink-0">{signKeyTtl === '86400' ? '(24小时)' : signKeyTtl === '3600' ? '(1小时)' : signKeyTtl === '21600' ? '(6小时)' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section F: 通用安全配置（限流等） */}
        {genericSecurityConfigs.length > 0 && (
          <Card className="border-stone-200">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-stone-800">其他安全配置</CardTitle>
                  <CardDescription>限流等通用安全参数，修改后点击其他区域自动保存</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {genericSecurityConfigs.map((config) => {
                  const sensitive = isSensitive(config.key);
                  const revealed = revealedKeys.has(config.key);
                  const isSaving = savingKeys.has(config.key);
                  const currentValue = editValues[config.key] ?? config.value;
                  const isBoolean = isBooleanConfig(config.key, currentValue);
                  const isSelect = isSelectConfig(config.key);

                  return (
                    <div
                      key={config.id}
                      className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0 max-w-[50%]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-700">
                            {config.description || config.key}
                          </span>
                          {config.isEncrypted && (
                            <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-600">
                              加密
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5 font-mono">{config.key}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                        {isBoolean ? (
                          <>
                            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                            <Switch
                              checked={currentValue === 'true'}
                              onCheckedChange={async (checked) => {
                                const newValue = checked ? 'true' : 'false';
                                setEditValues((prev) => ({ ...prev, [config.key]: newValue }));
                                setSavingKeys((prev) => new Set(prev).add(config.key));
                                try {
                                  await configsApi.updateItem(config.key, newValue);
                                  toast.success('配置已更新');
                                  setConfigs((prev) =>
                                    prev.map((c) => (c.key === config.key ? { ...c, value: newValue } : c))
                                  );
                                } catch (err: unknown) {
                                  toast.error(err instanceof Error ? err.message : '更新失败');
                                  setEditValues((prev) => ({ ...prev, [config.key]: config.value }));
                                } finally {
                                  setSavingKeys((prev) => {
                                    const next = new Set(prev);
                                    next.delete(config.key);
                                    return next;
                                  });
                                }
                              }}
                            />
                            <span className="text-sm text-stone-500">{currentValue === 'true' ? '开启' : '关闭'}</span>
                          </>
                        ) : isSelect ? (
                          <>
                            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                            <Select
                              value={currentValue}
                              onValueChange={async (val) => {
                                setEditValues((prev) => ({ ...prev, [config.key]: val }));
                                setSavingKeys((prev) => new Set(prev).add(config.key));
                                try {
                                  await configsApi.updateItem(config.key, val);
                                  toast.success('配置已更新');
                                  setConfigs((prev) =>
                                    prev.map((c) => (c.key === config.key ? { ...c, value: val } : c))
                                  );
                                } catch (err: unknown) {
                                  toast.error(err instanceof Error ? err.message : '更新失败');
                                  setEditValues((prev) => ({ ...prev, [config.key]: config.value }));
                                } finally {
                                  setSavingKeys((prev) => {
                                    const next = new Set(prev);
                                    next.delete(config.key);
                                    return next;
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="border-stone-200 w-[160px] h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SELECT_OPTIONS[config.key]?.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-stone-500">{getSelectLabel(config.key, currentValue)}</span>
                          </>
                        ) : (
                          <>
                            <div className="relative flex-1">
                              <Input
                                type={sensitive && !revealed ? 'password' : 'text'}
                                value={currentValue}
                                onChange={(e) => handleInlineChange(config.key, e.target.value)}
                                onBlur={() => handleInlineBlur(config)}
                                className={`border-stone-200 font-mono text-sm h-8 ${
                                  isSaving ? 'opacity-60 pr-8' : ''
                                }`}
                                placeholder="(空)"
                              />
                              {isSaving && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                                </div>
                              )}
                            </div>
                            {sensitive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => toggleReveal(config.key)}
                              >
                                {revealed ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 配置说明 */}
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm text-stone-700 space-y-1">
                <p className="font-medium">安全配置说明</p>
                <p>1. 开启「接口访问控制」后，除白名单路径外，所有 API 请求需携带 API Key 并进行签名验证</p>
                <p>2. 每个客户端有独立的 App ID 和 App Secret，用于生成请求签名</p>
                <p>3. 域名白名单仅对 Web 端请求生效，小程序请求通过 API Key 直接验证</p>
                <p>4. 时间戳容差建议 300 秒（5 分钟），防止重放攻击同时兼容时钟偏差</p>
                <p>5. 客户端凭证修改后必须点击「保存凭证」按钮才能生效</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // 通用配置列表渲染 (内联编辑)
  const renderConfigList = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      );
    }

    if (configs.length === 0) {
      return <div className="py-8 text-center text-sm text-stone-400">暂无配置项</div>;
    }

    return (
      <div className="space-y-1">
        {configs.map((config) => {
          const sensitive = isSensitive(config.key);
          const revealed = revealedKeys.has(config.key);
          const isSaving = savingKeys.has(config.key);
          const currentValue = editValues[config.key] ?? config.value;
          const isBoolean = isBooleanConfig(config.key, currentValue);
          const isSelect = isSelectConfig(config.key);

          return (
            <div
              key={config.id}
              className="flex items-center gap-4 rounded-lg px-4 py-3 hover:bg-stone-50 transition-colors group"
            >
              {/* 左侧：描述标签 + 配置键 */}
              <div className="flex-1 min-w-0 max-w-[50%]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">
                    {config.description || config.key}
                  </span>
                  {config.isEncrypted && (
                    <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-600">
                      加密
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400 mt-0.5 font-mono">{config.key}</p>
              </div>

              {/* 右侧：布尔开关 / 下拉选择 / 内联输入框 */}
              <div className="flex items-center gap-2 flex-1 max-w-[400px]">
                {isBoolean ? (
                  <>
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                    <Switch
                      checked={currentValue === 'true'}
                      onCheckedChange={async (checked) => {
                        const newValue = checked ? 'true' : 'false';
                        setEditValues((prev) => ({ ...prev, [config.key]: newValue }));
                        setSavingKeys((prev) => new Set(prev).add(config.key));
                        try {
                          await configsApi.updateItem(config.key, newValue);
                          toast.success('配置已更新');
                          setConfigs((prev) =>
                            prev.map((c) => (c.key === config.key ? { ...c, value: newValue } : c))
                          );
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : '更新失败');
                          setEditValues((prev) => ({ ...prev, [config.key]: config.value }));
                        } finally {
                          setSavingKeys((prev) => {
                            const next = new Set(prev);
                            next.delete(config.key);
                            return next;
                          });
                        }
                      }}
                    />
                    <span className="text-sm text-stone-500">{currentValue === 'true' ? '开启' : '关闭'}</span>
                  </>
                ) : isSelect ? (
                  <>
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                    <Select
                      value={currentValue}
                      onValueChange={async (val) => {
                        setEditValues((prev) => ({ ...prev, [config.key]: val }));
                        setSavingKeys((prev) => new Set(prev).add(config.key));
                        try {
                          await configsApi.updateItem(config.key, val);
                          toast.success('配置已更新');
                          setConfigs((prev) =>
                            prev.map((c) => (c.key === config.key ? { ...c, value: val } : c))
                          );
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : '更新失败');
                          setEditValues((prev) => ({ ...prev, [config.key]: config.value }));
                        } finally {
                          setSavingKeys((prev) => {
                            const next = new Set(prev);
                            next.delete(config.key);
                            return next;
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="border-stone-200 w-[160px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECT_OPTIONS[config.key]?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-stone-500">{getSelectLabel(config.key, currentValue)}</span>
                  </>
                ) : (
                  <>
                    <div className="relative flex-1">
                      <Input
                        type={sensitive && !revealed ? 'password' : 'text'}
                        value={currentValue}
                        onChange={(e) => handleInlineChange(config.key, e.target.value)}
                        onBlur={() => handleInlineBlur(config)}
                        className={`border-stone-200 font-mono text-sm h-8 ${
                          isSaving ? 'opacity-60 pr-8' : ''
                        }`}
                        placeholder="(空)"
                      />
                      {isSaving && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                        </div>
                      )}
                    </div>
                    {sensitive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => toggleReveal(config.key)}
                      >
                        {revealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">配置中心</h1>
        <p className="text-sm text-stone-500">管理系统配置项，修改后失焦自动保存 <span className="text-stone-300 ml-2">v{configGroups.length}组</span></p>
      </div>

      <Tabs value={activeGroup} onValueChange={setActiveGroup}>
        <TabsList className="bg-stone-100 flex-wrap h-auto gap-1 p-1">
          {configGroups.map((g) => (
            <TabsTrigger key={g.key} value={g.key} className="text-xs">
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {configGroups.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            {g.key === 'site' ? (
              renderSiteConfig()
            ) : g.key === 'about' ? (
              renderAboutConfig()
            ) : g.key === 'booking' ? (
              renderBookingConfig()
            ) : g.key === 'cos' ? (
              renderStorageConfig()
            ) : g.key === 'miniprogram' ? (
              renderMiniProgramConfig()
            ) : g.key === 'amap' ? (
              renderAmapConfig()
            ) : g.key === 'cache' ? (
              renderCacheConfig()
            ) : g.key === 'security' ? (
              renderSecurityConfig()
            ) : g.key === 'social_login' ? (
              renderSocialLoginConfig()
            ) : (
              <Card className="border-stone-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-stone-800">{g.label}</CardTitle>
                  <CardDescription>管理 {g.label.toLowerCase()} 相关设置，修改后点击其他区域自动保存</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderConfigList()}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
