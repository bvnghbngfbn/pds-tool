# 修改历史备份

## 修改记录

### 2026-07-31 - 删除阿里云短信SDK依赖

**修改时间：** 2026-07-31 02:26:01 UTC

**修改内容：**
- 删除了注释行：`# 可选：阿里云短信 SDK（Termux 等 ARM 环境可能无法安装，不影响应用启动）`
- 删除了SDK依赖行：`# alibabacloud-dypnsapi20170525==2.0.0`

**原因：** 彻底关闭阿里云短信功能，简化依赖管理

**提交哈希：** 17cfc72be5fe0ff029b7627157f97af7a4de99c9

**修改前的文件内容：**
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
aiosqlite==0.20.0
httpx==0.28.1
apscheduler==3.11.0
pydantic==2.10.5
pydantic-settings==2.7.1
python-multipart==0.0.19
PyYAML==6.0.2
python-jose[cryptography]==3.4.0
bcrypt==4.2.1
# 可选：阿里云短信 SDK（Termux 等 ARM 环境可能无法安装，不影响应用启动）
# alibabacloud-dypnsapi20170525==2.0.0
```

**修改后的文件内容：**
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
aiosqlite==0.20.0
httpx==0.28.1
apscheduler==3.11.0
pydantic==2.10.5
pydantic-settings==2.7.1
python-multipart==0.0.19
PyYAML==6.0.2
python-jose[cryptography]==3.4.0
bcrypt==4.2.1
```

---

## 相关链接

- 原始提交：https://github.com/bvnghbngfbn/pds-tool/commit/ef3726b65447d77a08857d2fedb4e9b27644722b
- 修改后提交：https://github.com/bvnghbngfbn/pds-tool/commit/17cfc72be5fe0ff029b7627157f97af7a4de99c9
- requirements.txt：https://github.com/bvnghbngfbn/pds-tool/blob/main/backend/requirements.txt
