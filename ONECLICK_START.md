# 一键启动指南

**版本**: v3.2 | 更新日期: 2026-02-07

本项目包含一键启动脚本，可快速搭建开发环境。

## 快速启动脚本

- `start_oneclick.bat` (Windows)
- `start_oneclick.sh` (Linux/Mac)

## 脚本功能

1. 检查 `conda`/`node` 是否可用（Linux/Mac 如无 conda 则回退到 `python3` venv）
2. 尝试释放端口 `5173`（前端）和 `8000`（后端）
3. 准备运行时数据库路径 (`data/oasis_simulation_run.db`)
4. 启动后端和前端服务
5. 保持原始的 `start.bat` / `start.sh` 不变

## 服务地址

- **前端**: `http://localhost:5173`
- **后端 API**: `http://localhost:8000`
- **后端文档**: `http://localhost:8000/docs`
- **WebSocket**: `ws://localhost:8000/ws`

## 手动启动命令

### 后端（推荐使用 Conda）

```powershell
cd backend
conda create -n socsim-py311 python=3.11 -y
conda run -n socsim-py311 python -m pip install -r requirements.txt
conda run -n socsim-py311 python -m pip install -e ..\oasis-main
set OASIS_DB_PATH=..\data\oasis_frontend.db
set OASIS_RUNTIME_DB_PATH=..\data\oasis_simulation_run.db
conda run -n socsim-py311 python main.py
```

### 后端（备选方案 venv，Linux/Mac）

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e ../oasis-main
OASIS_DB_PATH=../data/oasis_frontend.db \
OASIS_RUNTIME_DB_PATH=../data/oasis_simulation_run.db \
  python main.py
```

### 前端

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## 数据持久化

项目使用 **SQLite 嵌入式数据库** - 无需单独部署数据库：

- **Mock 模式**：前端生成模拟数据，无需后端
- **Real 模式**：后端使用 SQLite 数据库，位于 `data/oasis_frontend.db`
- **跨机器迁移**：只需复制数据库文件即可迁移数据

### 数据库配置

在 `backend/.env` 中设置 `OASIS_DB_PATH` 环境变量：

```env
# 默认位置
OASIS_DB_PATH=data/oasis_frontend.db

# 自定义位置
OASIS_DB_PATH=/path/to/custom/database.db
```

### LLM API 密钥

如需启用 LLM 功能，设置以下任一变量：

```env
LLM_API_KEY=your_api_key_here
DEEPSEEK_API_KEY=your_api_key_here
OPENAI_API_KEY=your_api_key_here
```

## 原始脚本

以下原始脚本已保留：

- `start.bat` - Windows 启动脚本
- `start.sh` - Linux/Mac 启动脚本

## 故障排除

### 端口已被占用

如果端口 5173 或 8000 被占用，脚本会尝试释放它们。如果失败：

**Windows:**
```powershell
# 查找并终止占用端口 5173 的进程
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# 查找并终止占用端口 8000 的进程
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# 查找并终止占用端口 5173 的进程
lsof -ti:5173 | xargs kill -9

# 查找并终止占用端口 8000 的进程
lsof -ti:8000 | xargs kill -9
```

### 未找到 Python

确保已安装 Python 3.11（推荐）并添加到 PATH：

```bash
python --version
```

### 未找到 Node

确保已安装 Node.js 18+ 并添加到 PATH：

```bash
node --version
npm --version
```

## 项目结构

```
SocSim-Lab/
├── frontend/           # React + Vite 前端
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── backend/            # FastAPI 后端
│   ├── main.py
│   ├── requirements.txt
│   └── .env
├── data/               # SQLite 数据库位置
│   └── oasis_frontend.db
├── start_oneclick.bat  # Windows 一键启动
├── start_oneclick.sh   # Linux/Mac 一键启动
└── README.md
```
