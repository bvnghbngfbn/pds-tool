"""FastAPI 主入口。"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import settings, STATIC_DIR
from .db import init_db
from .scheduler import start_scheduler, stop_scheduler
from .api import sourcing, products, tasks, settings as settings_api, dashboard, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await start_scheduler()
    yield
    await stop_scheduler()


app = FastAPI(title="铺货通 - 1688 自动铺货工具", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由
app.include_router(dashboard.router)
app.include_router(auth.router)
app.include_router(sourcing.router)
app.include_router(products.router)
app.include_router(tasks.router)
app.include_router(settings_api.router)


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "pds", "version": "1.1.0"}


# APK 下载专用路由（强制下载）
@app.get("/download")
async def download_page():
    from fastapi.responses import FileResponse as FR
    return FR(str(STATIC_DIR / "download.html"))


@app.get("/pds-app.apk")
async def download_apk():
    from fastapi.responses import FileResponse as FR
    fp = STATIC_DIR / "pds-app.apk"
    return FR(
        str(fp),
        media_type="application/vnd.android.package-archive",
        filename="铺货通.apk",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''%E9%93%BA%E8%B4%A7%E9%80%9A.apk"},
    )


# 前端静态资源 + SPA 回退（构建后产出在 backend/static）
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")
    icons_dir = STATIC_DIR / "icons"
    if icons_dir.exists():
        app.mount("/icons", StaticFiles(directory=str(icons_dir)), name="icons")

    @app.get("/manifest.json")
    async def manifest():
        return FileResponse(str(STATIC_DIR / "manifest.json"))

    @app.get("/sw.js")
    async def service_worker():
        # service worker 必须从根路径提供，且设置合适的缓存头
        return FileResponse(
            str(STATIC_DIR / "sw.js"),
            media_type="application/javascript",
            headers={"Cache-Control": "no-cache"},
        )

    @app.get("/{full_path:path}")
    async def spa(full_path: str, request: Request):
        # /api 未匹配路径返回 404
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}
        # 先检查是否是静态文件
        f = STATIC_DIR / full_path
        if f.exists() and f.is_file():
            return FileResponse(str(f))
        # 其余回退到 index.html（SPA 路由）
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(
                str(index),
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )
        return {"detail": "frontend not built"}
