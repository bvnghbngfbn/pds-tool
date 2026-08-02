# 电商铺货工具 API 文档

> 版本：v1.1.0 ｜ 基础地址：`http://localhost:8000` ｜ 全部接口返回 JSON

## 通用说明

- 所有 API 路径以 `/api` 开头
- 请求体和响应体均为 `application/json`
- 时间字段格式：ISO 8601（如 `2026-07-26T08:00:00`）
- 错误响应：`{"detail": "错误描述"}`
- 无需鉴权（单机部署版）

---

## 1. 健康检查

### `GET /api/health`

检查服务是否正常运行。

**响应示例**
```json
{
  "ok": true,
  "service": "pds",
  "version": "1.1.0"
}
```

---

## 2. 仪表盘

### `GET /api/dashboard/stats`

获取铺货整体统计数据（商品分布、任务统计、铺货成功率、近 7 天趋势）。

**响应示例**
```json
{
  "product_total": 12,
  "products_by_status": {
    "sourced": 3,
    "mapped": 5,
    "pushed": 4
  },
  "tasks_by_status": {
    "idle": 2,
    "done": 1
  },
  "push_total": 6,
  "push_success": 5,
  "push_failed": 1,
  "success_rate": 83.3,
  "trend": [
    { "date": "2026-07-20", "count": 0 },
    { "date": "2026-07-21", "count": 2 },
    { "date": "2026-07-26", "count": 3 }
  ]
}
```

---

## 3. 货源选品

### `POST /api/sourcing/search`

搜索货源商品。需在设置页配置供货端口 App Key/Secret；未配置时返回提示。

**请求体**
```json
{
  "keyword": "手机壳",
  "category_id": "",
  "page": 1,
  "page_size": 20,
  "price_min": null,
  "price_max": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| keyword | string | 否 | 搜索关键词 |
| category_id | string | 否 | 1688 类目 ID |
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页数量，默认 20 |
| price_min | float | 否 | 最低价 |
| price_max | float | 否 | 最高价 |

**响应示例**
```json
{
  "items": [
    {
      "offer_id": "123456789",
      "title": "厂家直销 硅胶手机壳 一件代发",
      "price": 3.8,
      "image_url": "https://...",
      "detail_url": "https://detail.1688.com/offer/123456789.html",
      "company": "义乌XX工厂",
      "category": "手机配件"
    }
  ],
  "total": 100,
  "page": 1
}
```

---

### `POST /api/sourcing/import`

导入单个 1688 商品到商品库。支持 offerId 或完整商品链接。无 API 凭证时自动降级为页面解析。

**请求体**
```json
{
  "offer": "https://detail.1688.com/offer/123456789.html"
}
```
或
```json
{
  "offer": "123456789"
}
```

**响应示例**
```json
{
  "id": 1,
  "source_offer_id": "123456789",
  "source_url": "https://detail.1688.com/offer/123456789.html",
  "title": "厂家直销 硅胶手机壳 一件代发",
  "status": "sourced",
  "price": 3.8,
  "stock": 9999,
  "image_urls": ["https://..."],
  "category_source": "手机配件",
  "category_target": "",
  "source_seller": "义乌XX工厂",
  "tags": "",
  "error": "",
  "markup_ratio": 1.0,
  "mapped_data": {},
  "created_at": "2026-07-26T08:00:00",
  "updated_at": "2026-07-26T08:00:00"
}
```

---

### `POST /api/sourcing/import/batch`

批量导入 1688 商品。

**请求体**
```json
{
  "offers": [
    "123456789",
    "https://detail.1688.com/offer/987654321.html"
  ]
}
```

**响应示例**
```json
{
  "imported": 2,
  "failed": 0,
  "items": [ { "id": 1, "title": "..." }, { "id": 2, "title": "..." } ]
}
```

---

### `POST /api/sourcing/refresh/{product_id}`

重新从 1688 拉取商品信息（刷新价格、库存等）。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| product_id | int | 商品库中的商品 ID |

**响应**：同 `import` 接口返回的商品对象。

---

## 4. 商品库

### `GET /api/products`

分页查询商品列表。

**Query 参数**

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| status | string | - | 按状态筛选：sourced/mapped/pending/pushed/failed/archived |
| keyword | string | - | 标题模糊搜索 |
| category | string | - | 类目筛选 |
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量（最大 100） |

**响应示例**
```json
{
  "items": [ { "id": 1, "title": "...", "status": "mapped", "price": 6.84, ... } ],
  "total": 12,
  "page": 1,
  "page_size": 20
}
```

---

### `GET /api/products/{product_id}`

获取单个商品详情（包含 raw_data 和 mapped_data）。

**响应示例**
```json
{
  "id": 1,
  "source_offer_id": "123456789",
  "title": "硅胶手机壳 爆款",
  "status": "mapped",
  "price": 6.84,
  "stock": 9999,
  "image_urls": ["https://..."],
  "category_source": "手机配件",
  "category_target": "数码配件/手机壳",
  "markup_ratio": 1.8,
  "mapped_data": {
    "title": "硅胶手机壳 爆款",
    "price": 6.84,
    "description": "<p>...</p>",
    "images": [...]
  },
  "raw_data": { "...1688原始数据..." },
  "created_at": "2026-07-26T08:00:00",
  "updated_at": "2026-07-26T08:05:00"
}
```

---

### `PATCH /api/products/{product_id}`

更新商品信息（部分更新）。

**请求体**（所有字段可选）
```json
{
  "title": "新标题",
  "tags": "热销,爆款",
  "markup_ratio": 2.0,
  "category_target": "数码配件/手机壳",
  "status": "pending"
}
```

---

### `DELETE /api/products/{product_id}`

删除商品。

**响应**：`{"ok": true}`

---

### `POST /api/products/{product_id}/map`

对单个商品执行字段映射转换（标题去噪、加价、类目映射、生成描述）。

**请求体**
```json
{
  "markup_ratio": 1.8,
  "auto_map": true,
  "target_category": ""
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| markup_ratio | float | 1.3 | 加价倍率 |
| auto_map | bool | true | 是否自动映射类目 |
| target_category | string | "" | 指定目标类目（优先于自动映射） |

**响应**：更新后的商品对象（含 mapped_data）。

---

### `POST /api/products/map/batch`

批量执行字段映射。

**请求体**
```json
{
  "product_ids": [1, 2, 3],
  "markup_ratio": 1.8,
  "auto_map": true
}
```

**响应**：`{"mapped": 3, "total": 3}`

---

### `GET /api/products/stats/summary`

商品库状态分布统计。

**响应示例**
```json
{
  "total": 12,
  "by_status": {
    "sourced": 3,
    "mapped": 5,
    "pushed": 4
  }
}
```

---

## 5. 铺货任务

### `GET /api/tasks`

获取所有铺货任务列表。

**响应示例**
```json
[
  {
    "id": 1,
    "name": "手机壳批量铺货",
    "task_type": "once",
    "status": "done",
    "target_type": "csv",
    "target_config": { "filename": "export.csv" },
    "filter_category": "",
    "filter_keyword": "手机壳",
    "filter_status": "mapped",
    "limit": 50,
    "markup_ratio": 1.8,
    "auto_map_category": true,
    "cron_expr": "",
    "last_run_at": "2026-07-26T08:10:00",
    "next_run_at": null,
    "total": 5,
    "success": 5,
    "failed": 0,
    "created_at": "2026-07-26T08:00:00"
  }
]
```

---

### `GET /api/tasks/{task_id}`

获取单个任务详情。

---

### `POST /api/tasks`

创建铺货任务。

**请求体**
```json
{
  "name": "每日自动铺货",
  "task_type": "scheduled",
  "target_type": "shopify",
  "target_config": {
    "shop_url": "mystore.myshopify.com",
    "access_token": "shpat_xxx"
  },
  "filter_category": "",
  "filter_keyword": "手机壳",
  "filter_tags": "",
  "filter_status": "mapped",
  "limit": 50,
  "markup_ratio": 1.8,
  "auto_map_category": true,
  "cron_expr": "0 9 * * *"
}
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| name | string | - | 任务名称 |
| task_type | string | once | `once`（一次性）/ `scheduled`（定时） |
| target_type | string | shopify | `pdd` / `douyin` / `kuaishou` / `shopify` / `generic` / `csv` |
| target_config | object | {} | 目标平台连接配置 |
| filter_category | string | "" | 筛选类目 |
| filter_keyword | string | "" | 筛选关键词 |
| filter_tags | string | "" | 筛选标签 |
| filter_status | string | mapped | 筛选商品状态 |
| limit | int | 50 | 单次铺货上限 |
| markup_ratio | float | 1.3 | 加价倍率 |
| auto_map_category | bool | true | 自动类目映射 |
| cron_expr | string | "" | Cron 表达式（定时任务必填） |

**target_config 各平台配置**

拼多多：
```json
{ "client_id": "xxx", "client_secret": "xxx", "access_token": "xxx", "mall_id": "xxx", "api_url": "https://..." }
```

抖音商店：
```json
{ "app_key": "xxx", "app_secret": "xxx", "access_token": "xxx", "shop_id": "xxx", "api_url": "https://..." }
```

快手小店：
```json
{ "app_id": "xxx", "app_secret": "xxx", "access_token": "xxx", "shop_id": "xxx", "api_url": "https://..." }
```

Shopify：
```json
{ "shop_url": "xxx.myshopify.com", "access_token": "shpat_xxx" }
```

通用 API：
```json
{ "url": "https://your-api.com/products", "headers": {"Authorization": "Bearer xxx"} }
```

CSV：
```json
{ "filename": "export.csv" }
```

---

### `PATCH /api/tasks/{task_id}`

更新任务（部分更新）。修改 `cron_expr` 会自动重新调度。

---

### `DELETE /api/tasks/{task_id}`

删除任务。

**响应**：`{"ok": true}`

---

### `POST /api/tasks/{task_id}/run`

立即执行任务（后台异步执行）。

**响应示例**
```json
{
  "ok": true,
  "message": "任务已加入后台执行"
}
```

---

### `GET /api/tasks/{task_id}/records`

获取任务的铺货执行记录。

**Query 参数**

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| status | string | - | 筛选状态：success/failed/pending/skipped |
| page | int | 1 | 页码 |
| page_size | int | 50 | 每页数量 |

**响应示例**
```json
{
  "items": [
    {
      "id": 1,
      "task_id": 1,
      "product_id": 5,
      "status": "success",
      "target_item_id": "shopify_123",
      "target_item_url": "https://mystore.myshopify.com/products/123",
      "message": "铺货成功",
      "created_at": "2026-07-26T08:10:00"
    }
  ],
  "total": 5,
  "page": 1,
  "page_size": 50
}
```

---

### `GET /api/tasks/{task_id}/logs`

获取任务执行日志。

**Query 参数**

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| limit | int | 100 | 返回条数 |

**响应示例**
```json
[
  {
    "id": 1,
    "level": "INFO",
    "message": "开始执行任务，共 5 个商品",
    "created_at": "2026-07-26T08:10:00"
  },
  {
    "id": 2,
    "level": "ERROR",
    "message": "商品 3 铺货失败: API 超时",
    "created_at": "2026-07-26T08:10:05"
  }
]
```

---

## 6. 平台设置

### `GET /api/settings`

获取所有设置项（按类别分组）。

**响应示例**
```json
{
  "alibaba": {
    "alibaba_app_key": "12****",
    "alibaba_app_secret": "ab****",
    "alibaba_access_token": ""
  },
  "shopify": {
    "shopify_shop_url": "mystore.myshopify.com",
    "shopify_access_token": "shpat_xxx"
  },
  "generic": {
    "generic_api_url": "",
    "generic_api_headers": ""
  },
  "general": {
    "default_markup_ratio": "1.8",
    "default_target_category": ""
  }
}
```

---

### `PUT /api/settings`

批量保存设置项。

**请求体**
```json
{
  "items": {
    "alibaba_app_key": "123456",
    "alibaba_app_secret": "abcdef"
  },
  "category": "alibaba"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| items | object | 键值对（key→value） |
| category | string | 类别：alibaba/pdd/douyin/kuaishou/shopify/generic/csv/general |

**响应**：`{"ok": true}`

---

### `GET /api/settings/test/{platform}`

测试平台凭证是否已配置。

**路径参数**

| 参数 | 可选值 |
|---|---|
| platform | `alibaba` / `pdd` / `douyin` / `kuaishou` / `shopify` / `generic` |

**响应示例**
```json
{
  "platform": "alibaba",
  "configured": true,
  "message": "凭证已配置"
}
```

---

## 7. 数据模型

### Product（商品）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int | 主键 |
| source_offer_id | string | 1688 offerId |
| source_url | string | 1688 商品链接 |
| title | string | 标题 |
| status | string | 状态：sourced/mapped/pending/pushed/failed/archived |
| raw_data | object | 1688 原始数据 |
| mapped_data | object | 转换后铺货数据 |
| price | float | 源价格 |
| stock | int | 库存 |
| image_urls | array | 图片 URL 列表 |
| category_source | string | 源类目 |
| category_target | string | 目标类目 |
| tags | string | 标签 |
| markup_ratio | float | 加价倍率 |
| source_seller | string | 1688 卖家 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### PushTask（铺货任务）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int | 主键 |
| name | string | 任务名称 |
| task_type | string | once/scheduled |
| status | string | idle/running/paused/done/error |
| target_type | string | pdd/douyin/kuaishou/shopify/generic/csv |
| target_config | object | 目标平台配置 |
| filter_* | string | 商品筛选条件 |
| limit | int | 单次铺货上限 |
| markup_ratio | float | 加价倍率 |
| cron_expr | string | Cron 表达式 |
| total | int | 总铺货数 |
| success | int | 成功数 |
| failed | int | 失败数 |

### PushRecord（铺货记录）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int | 主键 |
| task_id | int | 关联任务 |
| product_id | int | 关联商品 |
| status | string | success/failed/pending/skipped |
| target_item_id | string | 目标平台商品 ID |
| target_item_url | string | 目标平台商品链接 |
| message | string | 执行信息 |

---

## 8. 典型业务流程

```
1. 配置凭证
   PUT /api/settings  (category=alibaba, 填入 App Key/Secret)
   PUT /api/settings  (category=shopify, 填入店铺地址/Token)

2. 选品导入
   POST /api/sourcing/search  → 搜索 1688 商品
   POST /api/sourcing/import  → 导入到商品库

3. 字段映射
   POST /api/products/{id}/map  (markup_ratio=1.8)
   或 POST /api/products/map/batch  → 批量映射

4. 创建铺货任务
   POST /api/tasks  (target_type=shopify, filter_status=mapped)

5. 执行铺货
   POST /api/tasks/{id}/run  → 后台执行
   GET  /api/tasks/{id}/records  → 查看结果
   GET  /api/tasks/{id}/logs  → 查看日志
```

---

## 9. CORS 与部署

- 默认允许所有来源跨域（`cors_origins: ["*"]`）
- 可通过环境变量 `PDS_CORS_ORIGINS` 配置
- 数据库：SQLite，路径 `backend/data/pds.db`
- 监听：`0.0.0.0:8000`，可通过 `PDS_HOST` / `PDS_PORT` 修改
