# 在所有子模块导入前加载 .env，确保 os.environ 中有完整配置
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")