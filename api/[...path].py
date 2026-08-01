from mangum import Mangum
from backend.app.main import app

# Vercel Serverless Function 入口
handler = Mangum(app, lifespan="off")
