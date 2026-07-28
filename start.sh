#!/bin/bash
# 铺货通 Termux 一键启动脚本
set -e

echo ">>> 更新代码..."
cd ~/pds-tool
git checkout -- . 2>/dev/null
git pull origin main

echo ">>> 安装依赖..."
cd ~/pds-tool/backend
pip install -q fastapi uvicorn sqlalchemy aiosqlite httpx apscheduler pydantic pydantic-settings python-multipart PyYAML python-jose passlib bcrypt 2>&1 | tail -3

echo ">>> 启动后端..."
# 先杀掉旧进程
pkill -f "uvicorn app.main" 2>/dev/null || true
sleep 1

# 启动后端
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/pds.log 2>&1 &
sleep 3

# 检查是否启动成功
if pgrep -f "uvicorn app.main" > /dev/null; then
    echo ">>> 后端启动成功！"
else
    echo ">>> 后端启动失败，查看日志："
    cat /tmp/pds.log
    exit 1
fi

# 启动隧道
echo ">>> 启动隧道..."
ssh -R 80:localhost:8000 nokey@localhost.run