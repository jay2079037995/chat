#!/bin/bash
# 环境检查脚本 - 验证测试运行所需的环境条件
# 用法: ./scripts/check-env.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN=$((WARN + 1)); }

echo ""
echo "========================================="
echo "  Chat 项目 - 环境检查"
echo "========================================="
echo ""

# 1. Node.js
echo "【Node.js】"
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v)
  NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    pass "Node.js $NODE_VERSION (>= 18)"
  else
    fail "Node.js $NODE_VERSION (需要 >= 18)"
  fi
else
  fail "Node.js 未安装"
fi

# 2. pnpm
echo "【pnpm】"
if command -v pnpm &>/dev/null; then
  PNPM_VERSION=$(pnpm -v)
  pass "pnpm v$PNPM_VERSION"
else
  fail "pnpm 未安装 (npm install -g pnpm)"
fi

# 3. Redis
echo "【Redis】"
if command -v redis-cli &>/dev/null; then
  pass "redis-cli 已安装"
  if redis-cli ping &>/dev/null; then
    pass "Redis 服务运行中"
  else
    fail "Redis 服务未启动 (redis-server --daemonize yes)"
  fi
else
  fail "Redis 未安装"
fi

# 4. 依赖安装
echo "【项目依赖】"
if [ -d "node_modules" ]; then
  pass "根目录 node_modules 存在"
else
  fail "根目录 node_modules 不存在 (pnpm install)"
fi

for pkg in client server shared; do
  if [ -d "packages/$pkg/node_modules" ] || [ -d "node_modules/@chat/$pkg" ]; then
    pass "packages/$pkg 依赖就绪"
  else
    warn "packages/$pkg 可能需要 pnpm install"
  fi
done

# 5. 项目结构
echo "【项目结构】"
for f in pnpm-workspace.yaml tsconfig.json CLAUDE.md; do
  if [ -f "$f" ]; then
    pass "$f 存在"
  else
    fail "$f 缺失"
  fi
done

echo ""
echo "========================================="
echo -e "  结果: ${GREEN}$PASS 通过${NC}, ${RED}$FAIL 失败${NC}, ${YELLOW}$WARN 警告${NC}"
echo "========================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
