#!/bin/bash
# ====================================
# 光影集 - 快速部署脚本
# 用法：bash deploy-quick.sh [选项]
#
# 选项：
#   --skip-build   跳过构建（使用已有构建）
#   --skip-install 跳过依赖安装
#   --skip-db      跳过数据库同步
#   --rollback     回滚到上一次备份
#   --dry-run      仅显示将执行的步骤，不实际执行
# ====================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ==================== 解析命令行参数 ====================
SKIP_BUILD=false
SKIP_INSTALL=false
SKIP_DB=false
ROLLBACK=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-build)   SKIP_BUILD=true ;;
    --skip-install) SKIP_INSTALL=true ;;
    --skip-db)      SKIP_DB=true ;;
    --rollback)     ROLLBACK=true ;;
    --dry-run)      DRY_RUN=true ;;
    *)
      echo "未知参数: $arg"
      echo "用法: bash deploy-quick.sh [--skip-build] [--skip-install] [--skip-db] [--rollback] [--dry-run]"
      exit 1
      ;;
  esac
done

# 部署目标目录（宝塔面板实际运行目录）
DEPLOY_DIR="${DEPLOY_DIR:-/www/wwwroot/HuaNian_photo}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_step() { echo -e "\n${CYAN}[$1]${NC} $2"; }
log_ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
log_err()  { echo -e "  ${RED}✗${NC} $1"; }
log_info() { echo -e "  ${CYAN}ℹ${NC} $1"; }

# Dry-run 包装器：执行命令前先打印
run_cmd() {
  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}[DRY-RUN]${NC} $*"
  else
    eval "$@"
  fi
}

# 计时器
SCRIPT_START=$(date +%s)

echo "========================================"
echo -e "  ${BOLD}光影集 - 快速部署${NC}"
echo "  项目: $PROJECT_DIR"
echo "  部署: $DEPLOY_DIR"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
if [ "$DRY_RUN" = true ]; then
  echo -e "  ${YELLOW}模式: DRY-RUN（仅预览，不实际执行）${NC}"
fi
echo "========================================"

# ==================== 回滚模式 ====================
if [ "$ROLLBACK" = true ]; then
  log_step "回滚" "查找最近的备份..."

  LATEST_BACKUP=$(ls -dt .next-backup-* 2>/dev/null | head -1)
  if [ -z "$LATEST_BACKUP" ]; then
    log_err "未找到任何备份，无法回滚"
    exit 1
  fi

  log_info "找到备份: $LATEST_BACKUP"

  run_cmd "pm2 stop sheying 2>/dev/null || true"
  run_cmd "pm2 delete sheying 2>/dev/null || true"

  run_cmd "rm -rf .next/standalone"
  run_cmd "cp -r \"$LATEST_BACKUP\" .next/standalone"

  run_cmd "pm2 start ecosystem.config.js"
  run_cmd "pm2 save"

  if [ "$DRY_RUN" != true ]; then
    log_ok "已回滚到备份: $LATEST_BACKUP"
    log_info "请检查服务是否正常运行: pm2 logs sheying --lines 30"
  fi
  exit 0
fi

# ==================== 0. 前置检查 ====================
log_step "0" "前置检查..."

if [ ! -f ".env" ]; then
  log_err "未找到 .env 文件！请先配置环境变量。"
  exit 1
fi
log_ok ".env 文件存在"

if ! command -v node &> /dev/null; then
  log_err "未找到 node，请先安装 Node.js（推荐 v18+）"
  exit 1
fi
NODE_VERSION=$(node -v)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  log_err "Node.js 版本过低（$NODE_VERSION），推荐 v18 或更高"
  exit 1
fi
log_ok "Node.js $NODE_VERSION"

if ! command -v npm &> /dev/null; then
  log_err "未找到 npm"
  exit 1
fi
log_ok "npm $(npm -v)"

if ! command -v pm2 &> /dev/null; then
  log_err "未找到 pm2，请先安装: npm install -g pm2"
  exit 1
fi
log_ok "PM2 $(pm2 -v)"

# ==================== 1. 停止旧服务 ====================
log_step "1" "停止旧服务..."

run_cmd "pm2 stop sheying 2>/dev/null || true"
run_cmd "pm2 delete sheying 2>/dev/null || true"
log_ok "旧服务已停止"

# ==================== 3. 备份当前构建 ====================
log_step "3" "备份当前构建..."

if [ -d ".next/standalone" ]; then
  BACKUP_DIR=".next-backup-$(date '+%Y%m%d%H%M%S')"
  run_cmd "cp -r .next/standalone \"$BACKUP_DIR\""
  # 只保留最近3个备份
  run_cmd "ls -dt .next-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true"
  log_ok "已备份到 $BACKUP_DIR"
else
  log_warn "无现有构建可备份"
fi

# ==================== 4. 清理旧构建缓存 ====================
log_step "4" "清理旧构建..."

run_cmd "rm -rf .next"
run_cmd "rm -rf node_modules/.cache"
run_cmd "rm -rf /tmp/turbopack-* 2>/dev/null || true"
run_cmd "rm -rf /tmp/next-* 2>/dev/null || true"
log_ok "清理完成"

# ==================== 5. 安装/更新依赖（智能检测） ====================
log_step "5" "依赖检查与安装..."

if [ "$SKIP_INSTALL" = true ]; then
  log_info "已跳过依赖安装（--skip-install）"
else
  NEED_INSTALL=false

  # 检查 node_modules 是否存在
  if [ ! -d "node_modules" ]; then
    NEED_INSTALL=true
    log_info "node_modules 不存在，需要安装依赖"
  else
    # 检查关键依赖是否完整
    MISSING_PKGS=""
    CRITICAL_PKGS="next react @prisma/client mysql2 sharp ioredis nodemailer cos-nodejs-sdk-v5"
    for pkg in $CRITICAL_PKGS; do
      if [ ! -d "node_modules/$pkg" ]; then
        MISSING_PKGS="$MISSING_PKGS $pkg"
      fi
    done

    if [ -n "$MISSING_PKGS" ]; then
      NEED_INSTALL=true
      log_info "缺失关键依赖:$MISSING_PKGS"
    else
      # 检查 package-lock.json 与 node_modules 的时间戳一致性
      if [ -f "package-lock.json" ]; then
        LOCK_MTIME=$(stat -c %Y "package-lock.json" 2>/dev/null || stat -f %m "package-lock.json" 2>/dev/null || echo 0)
        NM_MTIME=$(stat -c %Y "node_modules" 2>/dev/null || stat -f %m "node_modules" 2>/dev/null || echo 0)
        if [ "$LOCK_MTIME" -gt "$NM_MTIME" ]; then
          NEED_INSTALL=true
          log_info "package-lock.json 比 node_modules 更新，需要重新安装"
        fi
      fi

      # 检查 Prisma 客户端是否已生成
      if [ ! -d "node_modules/.prisma/client" ]; then
        log_info "Prisma 客户端未生成，将在数据库步骤中生成"
      fi
    fi
  fi

  if [ "$NEED_INSTALL" = true ]; then
    INSTALL_START=$(date +%s)
    if [ -f "package-lock.json" ]; then
      log_info "使用 npm ci 安装（基于 package-lock.json）..."
      run_cmd "npm ci --legacy-peer-deps 2>&1" || run_cmd "npm install --legacy-peer-deps 2>&1"
    else
      log_info "使用 npm install 安装..."
      run_cmd "npm install --legacy-peer-deps 2>&1" || run_cmd "npm install --force 2>&1"
    fi
    INSTALL_END=$(date +%s)
    INSTALL_TIME=$((INSTALL_END - INSTALL_START))
    log_ok "依赖安装完成 (耗时 ${INSTALL_TIME}s)"
  else
    log_ok "依赖完整，无需重新安装"
  fi
fi

# ==================== 6. 生成 Prisma 客户端 & 同步数据库 ====================
log_step "6" "数据库准备..."

# Prisma 客户端生成
if [ ! -d "node_modules/.prisma/client" ] || [ "prisma/schema.prisma" -nt "node_modules/.prisma/client" ]; then
  run_cmd "./node_modules/.bin/prisma generate 2>&1 || npx prisma@6 generate 2>&1"
  log_ok "Prisma 客户端生成完成"
else
  log_ok "Prisma 客户端已是最新，跳过生成"
fi

# 数据库同步
if [ "$SKIP_DB" = true ]; then
  log_info "已跳过数据库同步（--skip-db）"
else
  if [ "$DRY_RUN" != true ]; then
    if ./node_modules/.bin/prisma db push 2>&1; then
      log_ok "数据库表结构已同步"
    else
      log_warn "数据库同步失败，尝试使用 --accept-data-loss..."
      log_warn "⚠ 注意：--accept-data-loss 可能导致数据丢失！"
      ./node_modules/.bin/prisma db push --accept-data-loss 2>&1 || log_warn "数据库同步失败，继续部署..."
      log_ok "数据库表结构已同步（可能丢失了部分数据）"
    fi
  else
    run_cmd "./node_modules/.bin/prisma db push"
  fi
fi

# 运行配置修复
run_cmd "node fix-configs.js 2>&1" || log_warn "配置修复失败，可能需要手动检查"
log_ok "配置修复完成"

# ==================== 7. 构建项目 ====================
if [ "$SKIP_BUILD" = true ]; then
  log_step "7" "跳过构建（--skip-build）..."
  if [ ! -d ".next/standalone" ]; then
    log_err ".next/standalone 不存在！不能跳过构建。"
    exit 1
  fi
  log_ok "使用已有构建"
else
  log_step "7" "构建项目..."

  # 构建时用 .env 确保数据库连接可用
  if [ -f ".env" ] && [ ! -f ".env.production" ]; then
    run_cmd "cp .env .env.production"
    log_ok "已复制 .env -> .env.production"
  fi

  # 预创建 .next 目录结构，防止 Turbopack 竞态条件导致 ENOENT
  run_cmd "mkdir -p .next/static .next/cache"

  BUILD_START=$(date +%s)

  if [ "$DRY_RUN" != true ]; then
    if npx next build 2>&1; then
      BUILD_END=$(date +%s)
      BUILD_TIME=$((BUILD_END - BUILD_START))
      log_ok "构建成功 (耗时 ${BUILD_TIME}s)"
    else
      log_err "构建失败！"
      # 回滚：恢复备份
      if [ -n "${BACKUP_DIR:-}" ] && [ -d "$BACKUP_DIR" ]; then
        log_warn "正在回滚到上一个构建..."
        rm -rf .next/standalone 2>/dev/null || true
        cp -r "$BACKUP_DIR" .next/standalone
        pm2 start ecosystem.config.js 2>/dev/null || true
        pm2 save 2>/dev/null || true
        log_warn "已回滚到上一个版本，服务已重启"
      fi
      exit 1
    fi
  else
    run_cmd "npx next build"
    log_info "构建预估耗时: 2-5 分钟"
  fi
fi

# ==================== 8. 部署 ====================
log_step "8" "部署文件..."

# 同步 standalone 文件
if [ -d ".next/standalone" ]; then
  run_cmd "cp -r .next/static .next/standalone/.next/ 2>/dev/null"
  run_cmd "cp -r public .next/standalone/ 2>/dev/null"
  run_cmd "mkdir -p .next/standalone/uploads/works"

  # 复制 .env
  run_cmd "cp .env .next/standalone/.env 2>/dev/null"

  # Prisma 相关
  if [ -d "prisma" ]; then
    run_cmd "mkdir -p .next/standalone/prisma"
    run_cmd "cp prisma/schema.prisma .next/standalone/prisma/ 2>/dev/null"
  fi

  if [ -d "node_modules/.prisma" ]; then
    run_cmd "mkdir -p .next/standalone/node_modules/.prisma"
    run_cmd "cp -r node_modules/.prisma/client .next/standalone/node_modules/.prisma/ 2>/dev/null"
  fi

  if [ ! -d ".next/standalone/node_modules/@prisma/client" ]; then
    run_cmd "mkdir -p .next/standalone/node_modules/@prisma"
    run_cmd "cp -r node_modules/@prisma/client .next/standalone/node_modules/@prisma/ 2>/dev/null"
  fi

  # 复制 Prisma 引擎二进制
  for engine_file in node_modules/.prisma/client/*.node; do
    if [ -f "$engine_file" ]; then
      run_cmd "cp \"$engine_file\" .next/standalone/node_modules/.prisma/client/ 2>/dev/null"
    fi
  done

  # 复制 serverExternalPackages 模块（含其依赖）
  copy_pkg_with_deps() {
    local pkg="$1"
    if [ -d "node_modules/$pkg" ] && [ ! -d ".next/standalone/node_modules/$pkg" ]; then
      run_cmd "cp -r \"node_modules/$pkg\" \".next/standalone/node_modules/\" 2>/dev/null"
      # 复制该包的直接依赖（仅顶层）
      if [ -f "node_modules/$pkg/package.json" ]; then
        local deps
        deps=$(node -e "
          const p = require('./node_modules/$pkg/package.json');
          const all = { ...p.dependencies, ...p.peerDependencies };
          console.log(Object.keys(all).join(' '));
        " 2>/dev/null || echo "")
        for dep in $deps; do
          if [ -d "node_modules/$dep" ] && [ ! -d ".next/standalone/node_modules/$dep" ]; then
            run_cmd "cp -r \"node_modules/$dep\" \".next/standalone/node_modules/\" 2>/dev/null"
          fi
        done
      fi
    fi
  }

  for pkg in nodemailer cos-nodejs-sdk-v5 ioredis sharp z-ai-web-dev-sdk; do
    copy_pkg_with_deps "$pkg"
  done

  log_ok "standalone 文件已组装"

  # 同步到部署目录（如果配置了且与项目目录不同）
  if [ -d "$DEPLOY_DIR" ] && [ "$DEPLOY_DIR" != "$PROJECT_DIR" ]; then
    log_info "检测到部署目录: $DEPLOY_DIR"
    if command -v rsync &> /dev/null; then
      run_cmd "rsync -avz --delete \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='logs' \
        --exclude='.env' \
        --exclude='uploads' \
        .next/standalone/ \"$DEPLOY_DIR/.next/standalone/\" 2>/dev/null" || {
        log_warn "rsync 失败，使用 cp 同步（不会删除旧文件）"
        run_cmd "cp -r .next/standalone/* \"$DEPLOY_DIR/.next/standalone/\" 2>/dev/null" || log_warn "部署目录同步失败"
      }
    else
      run_cmd "cp -r .next/standalone/* \"$DEPLOY_DIR/.next/standalone/\" 2>/dev/null" || log_warn "部署目录同步失败"
    fi
    if [ -f "$DEPLOY_DIR/.env" ]; then
      log_ok "部署目录 .env 已存在，不覆盖"
    else
      run_cmd "cp .env \"$DEPLOY_DIR/.env\" 2>/dev/null || true"
    fi
    run_cmd "mkdir -p \"$DEPLOY_DIR/uploads/works\" 2>/dev/null || true"
    log_ok "已同步到 $DEPLOY_DIR"
  fi
else
  log_warn ".next/standalone 不存在，跳过 standalone 组装"
fi

# ==================== 9. 启动服务 & 健康检查 ====================
log_step "9" "启动服务..."

run_cmd "pm2 start ecosystem.config.js"
run_cmd "pm2 save"
log_ok "PM2 服务已启动"

# 清理 Nginx 缓存
if [ -d "/www/server/nginx/proxy_cache_dir" ]; then
  run_cmd "rm -rf /www/server/nginx/proxy_cache_dir/* 2>/dev/null"
  log_ok "Nginx 缓存已清理"
fi

if command -v nginx &> /dev/null; then
  run_cmd "nginx -s reload 2>/dev/null" && log_ok "Nginx 已重载" || true
fi

# 健康检查
if [ "$DRY_RUN" != true ]; then
  sleep 3
  HEALTH_PORT=$(grep -E '^PORT=' .env 2>/dev/null | sed 's/PORT=//' | tr -d '"' | tr -d "'" || echo "53626")
  HEALTH_PORT=${HEALTH_PORT:-53626}
  HEALTH_CHECK_URL="http://127.0.0.1:${HEALTH_PORT}/api/v1/stats/public"

  if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_CHECK_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      log_ok "健康检查通过 (HTTP $HTTP_CODE)"
    else
      log_warn "健康检查返回 HTTP $HTTP_CODE，请检查日志: pm2 logs sheying --lines 30"
    fi
  else
    log_warn "curl 不可用，跳过健康检查"
  fi
fi

# 清理旧备份（保留最近3个）
ls -dt .next-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

# 显示部署摘要
SCRIPT_END=$(date +%s)
TOTAL_TIME=$((SCRIPT_END - SCRIPT_START))

echo ""
echo "========================================"
echo -e "  ${GREEN}部署完成！${NC} (总耗时 ${TOTAL_TIME}s)"
echo ""
echo "  提示：访问页面后请按 Ctrl+Shift+R 强制刷新"
echo "  日志：pm2 logs sheying --lines 50"
echo "  重启：pm2 restart sheying"
echo "  状态：pm2 status sheying"
echo "  回滚：bash deploy-quick.sh --rollback"
echo "========================================"
