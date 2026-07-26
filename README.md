# 铺货通 — 1688 自动铺货工具

从 1688 选品 → 字段/加价转换 → 自动铺货到零售平台的一站式工具。一件代发模式，开箱即用。

## 功能

- **1688 选品**：通过 1688 开放平台 API 搜索/导入商品；无 API 凭证时自动降级为页面解析兜底
- **商品库管理**：商品入库、状态流转、批量编辑、详情查看
- **智能转换**：标题去噪、加价策略、类目映射、描述/图片自动生成
- **多平台铺货**：
  - Shopify（Admin REST API 真实上架）
  - 通用 HTTP API（对接自建店铺/有赞/微店等）
  - CSV 批量导出（兼容淘宝/拼多多等批量导入格式）
- **自动化调度**：Cron 定时铺货任务，后台自动扫描执行
- **可视化监控**：仪表盘统计、近 7 天趋势、任务执行记录与日志

## 架构

```
backend/   Python FastAPI + SQLAlchemy + APScheduler + SQLite
  app/sourcing/    1688 API 客户端(签名算法) + 页面解析兜底
  app/transform/   字段映射/加价/类目/标题去噪
  app/push/        Shopify / 通用API / CSV 三个铺货目标
  app/scheduler.py Cron 定时调度
  app/api/         REST 接口
frontend/  React + Vite + Tailwind + Recharts
```

## 快速开始

### 一键启动

```bash
cd /workspace
bash start.sh
```

启动后访问 `http://localhost:8000`，前端已由后端托管。

### 手动启动

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 前端开发（可选，独立热更新）
cd frontend
npm install
npm run dev   # http://localhost:5173，自动代理 /api 到后端
```

### 构建前端到后端

```bash
cd frontend && npm run build   # 产物输出到 backend/static
```

## 使用流程

1. **配置凭证**（平台设置页）
   - 1688：填入开放平台 App Key / App Secret / Access Token（open.1688.com 申请）
   - 未配置时可用 offer 链接导入，自动走页面解析兜底
   - Shopify：填店铺地址 + Admin API Token（CSV 模式无需任何配置即可试用）

2. **选品导入**（1688 选品页）
   - 关键词搜索 1688 商品，或直接粘贴 offer 链接/ID 批量导入

3. **转换映射**（商品库页）
   - 设置加价倍率，选中商品批量转换（标题去噪、售价计算、类目映射）

4. **铺货执行**（铺货任务页）
   - 新建任务，选择目标平台与筛选条件
   - 立即执行或设置 Cron 定时（如 `0 9 * * *` 每天 9 点）
   - 查看执行记录与日志

## 关键说明

- **1688 API 接入**：实现阿里开放平台标准 MD5 签名（参数升序拼接、首尾加 App Secret）。真实批量铺货需在 open.1688.com 注册 ISV 应用并授权。沙箱/试用可用页面解析兜底。
- **页面解析兜底**：从 1688 详情页嵌入的 JS 数据中提取商品信息，受站点反爬策略影响，建议正式使用走开放 API。
- **加价策略**：默认按倍率计算，售价 >10 元时凑整到 `.9` 结尾（电商常见定价），可调整。
- **数据存储**：SQLite 单文件 `backend/data/pds.db`，零配置，便于迁移。

## API 概览

| 模块 | 端点 |
|---|---|
| 仪表盘 | `GET /api/dashboard/stats` |
| 选品 | `POST /api/sourcing/search` · `POST /api/sourcing/import` |
| 商品 | `GET /api/products` · `POST /api/products/{id}/map` |
| 任务 | `GET /api/tasks` · `POST /api/tasks` · `POST /api/tasks/{id}/run` |
| 设置 | `GET /api/settings` · `PUT /api/settings` · `GET /api/settings/test/{platform}` |

## 技术栈

Python 3.10+ · FastAPI · SQLAlchemy · APScheduler · httpx · React 18 · Vite · Tailwind CSS · Recharts
