#!/bin/bash
# 铺货通 PDS Tool - 一键部署脚本
# 运行前请设置环境变量，切勿将凭证写入此文件

set -e

echo "========== 铺货通 一键部署 =========="

# 1. 安装 Docker（如果未安装）
if ! command -v docker &> /dev/null; then
    echo ">>> 安装 Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker && systemctl start docker
fi

# 2. 创建项目目录
mkdir -p /opt/pds-tool && cd /opt/pds-tool

# 3. 创建 Dockerfile
cat > Dockerfile << 'DOCKERFILE'
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend-builder /app/backend/static static
RUN mkdir -p /data
ENV PORT=7860
ENV DATA_DIR=/data
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
DOCKERFILE

# 4. 创建 docker-compose.yml（凭证从环境变量注入）
cat > docker-compose.yml << 'COMPOSE'
services:
  pds:
    build: .
    ports:
      - "80:7860"
    environment:
      - PDS_SECRET_KEY=${PDS_SECRET_KEY:-change-me-in-production}
      - PDS_JWT_SECRET_KEY=${PDS_JWT_SECRET_KEY:-change-me-in-production}
      - PDS_SMTP_HOST=${PDS_SMTP_HOST:-smtp.qq.com}
      - PDS_SMTP_PORT=${PDS_SMTP_PORT:-587}
      - PDS_SMTP_USER=${PDS_SMTP_USER:-}
      - PDS_SMTP_PASSWORD=${PDS_SMTP_PASSWORD:-}
      - PDS_SMTP_FROM=${PDS_SMTP_FROM:-}
      - PDS_SMTP_USE_TLS=${PDS_SMTP_USE_TLS:-true}
      - PDS_ALIYUN_ACCESS_KEY_ID=${PDS_ALIYUN_ACCESS_KEY_ID:-}
      - PDS_ALIYUN_ACCESS_KEY_SECRET=${PDS_ALIYUN_ACCESS_KEY_SECRET:-}
      - DATA_DIR=/data
    volumes:
      - pds_data:/data
    restart: always
    mem_limit: 512m

volumes:
  pds_data:
COMPOSE

# 5. 克隆代码（请设置 GIT_REPO_URL 环境变量）
echo ">>> 克隆代码..."
GIT_REPO=${GIT_REPO_URL:-}
if [ -z "$GIT_REPO" ]; then
    echo "错误: 请设置 GIT_REPO_URL 环境变量"
    exit 1
fi
if [ -d "pds-tool" ]; then
    cd pds-tool && git pull
else
    git clone "$GIT_REPO"
    cd pds-tool
fi

# 6. 复制 Dockerfile 和 compose 文件
cp ../Dockerfile ../docker-compose.yml .

# 7. 构建并启动
echo ">>> 构建并启动..."
docker compose up -d --build

echo ""
echo "========== 部署完成！ =========="
echo "访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP')"
echo ""
echo "查看日志: docker compose logs -f"
echo "重启服务: docker compose restart"
echo "停止服务: docker compose down"