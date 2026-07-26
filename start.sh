#!/usr/bin/env bash
# 铺货通一键启动脚本
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== 铺货通 启动 ==="

# 1. 后端依赖
echo "[1/3] 安装后端依赖..."
pip install -q --break-system-packages -r backend/requirements.txt 2>/dev/null || true

# 2. 前端构建（如未构建或源码更新）
if [ ! -f backend/static/index.html ] || [ frontend/src -nt backend/static/index.html ]; then
  echo "[2/3] 构建前端..."
  cd frontend
  [ -d node_modules ] || npm install --silent 2>/dev/null
  npm run build --silent 2>/dev/null
  cd "$ROOT"
else
  echo "[2/3] 前端已构建，跳过"
fi

# 3. 启动后端（托管前端）
echo "[3/3] 启动服务..."
echo "访问: http://localhost:8000"
echo "按 Ctrl+C 停止"
cd backend
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
