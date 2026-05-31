# 光影集 - 摄影作品展示平台

一个基于 Next.js 的摄影作品展示网站，支持PC端浏览、微信小程序访问，具备完整的后台管理系统。

## 功能特性

- 🖼️ **作品展示** - 瀑布流布局，支持EXIF信息展示
- 📂 **分类管理** - 树形分类结构，支持排序
- 🤖 **AI标签** - 集成AI智能标签识别
- 👥 **用户系统** - 邮箱注册登录 + 微信小程序登录
- 💬 **评论互动** - 评论审核机制
- ❤️ **收藏点赞** - 用户收藏与点赞
- 📅 **预约拍摄** - 在线预约拍摄服务
- 🔧 **后台管理** - 完整的管理后台
- 📱 **微信小程序** - 配套小程序端
- ☁️ **双存储模式** - 本地存储 / 腾讯云COS

## 技术栈

- **前端**: Next.js 15 + React 19 + Tailwind CSS + shadcn/ui
- **后端**: Next.js API Routes + Express + Prisma ORM
- **数据库**: MySQL
- **存储**: 本地存储 / 腾讯云COS
- **部署**: PM2 + Nginx

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
# 克隆项目
git clone https://gitee.com/huanian/sheying.git
cd sheying

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 MySQL 连接和 JWT_SECRET
# DATABASE_URL=mysql://用户名:密码@主机:端口/sheying

# 初始化数据库
npx prisma generate
npx prisma db push

# 构建项目
npm run build

# 启动开发服务器
npm run dev
```

### 生产部署

```bash
# 方式一：使用部署脚本
bash deploy.sh

# 方式二：手动部署
npm run build
bash start-server.sh

# 方式三：PM2管理
pm2 start ecosystem.config.js
```

### 宝塔面板部署

1. 在宝塔安装 MySQL 并创建数据库 `sheying`（utf8mb4编码）
2. 将项目文件上传到网站目录
3. 在宝塔安装 Node.js 18+
4. 复制 `.env.production` 为 `.env` 并配置 MySQL 连接
5. 运行部署脚本: `bash deploy.sh`
6. 配置 Nginx 反向代理到 127.0.0.1:53626

详细部署文档见 `.env.production` 和 `deploy.sh`。

## 默认管理员

首次部署后，访问 `/admin/login` 使用以下默认账号：

- 邮箱: admin@photo.com
- 密码: admin123456

> 建议部署后立即修改管理员密码

## 目录结构

```
├── prisma/              # 数据库Schema
├── public/              # 静态资源
├── src/
│   ├── app/             # Next.js页面
│   │   ├── admin/       # 管理后台
│   │   ├── api/v1/      # API接口
│   │   └── ...          # 前端页面
│   ├── components/      # 组件
│   │   ├── pc/          # PC端组件
│   │   └── ui/          # UI基础组件
│   ├── hooks/           # 自定义Hooks
│   ├── lib/             # 工具库
│   └── stores/          # 状态管理
├── miniprogram/         # 微信小程序
├── uploads/             # 上传文件目录
├── db/                  # 数据库相关
├── deploy.sh            # 部署脚本
├── ecosystem.config.js  # PM2配置
└── start-server.sh      # 启动脚本
```

## Nginx 配置参考

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:53626;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 许可证

MIT License
