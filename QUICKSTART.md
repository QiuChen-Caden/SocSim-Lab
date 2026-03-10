# SocSim Lab v3.2 - 快速启动指南

## 一键启动 (推荐)

双击运行 `start.bat`，脚本会自动：
1. 检查并安装后端依赖
2. 检查并安装前端依赖
3. 启动后端服务 (http://localhost:8000)
4. 启动前端服务 (http://localhost:5173)

## 手动启动

### 方法 1: 使用 npm
```bash
# 首次运行需要安装依赖
npm install

# 一键启动前后端
npm start
```

### 方法 2: 分别启动

**后端:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

**前端:**
```bash
cd frontend
npm install
npm run dev
```

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端界面 | http://localhost:5173 | 主应用界面 |
| 后端 API | http://localhost:8000 | REST API |
| API 文档 | http://localhost:8000/docs | Swagger UI |

## 停止服务

双击运行 `stop.bat`，或在各自的服务窗口按 `Ctrl+C`

## 系统要求

- **Python**: 3.10+
- **Node.js**: 18+
- **操作系统**: Windows 10/11, macOS, Linux

## 配置说明

### 环境变量

**后端** (`backend/.env`):
```env
DEBUG=true
USE_OASIS=true
# LLM_API_KEY=your_key_here  # 可选，用于 LLM 功能
```

**前端** (`frontend/.env`):
```env
VITE_USE_REAL_API=true       # true=连接后端, false=使用模拟数据
VITE_USE_WEBSOCKET=false     # WebSocket 实时更新
VITE_API_URL=http://localhost:8000
```

## 故障排除

### 后端启动失败
- 检查 Python 版本: `python --version`
- 重新创建虚拟环境: `cd backend && rmdir /s venv && python -m venv venv`

### 前端启动失败
- 删除 node_modules: `cd frontend && rmdir /s node_modules`
- 重新安装: `npm install`

### 端口冲突
- 修改 `backend/main.py` 中的端口号
- 修改 `frontend/vite.config.ts` 中的代理端口

## 项目结构

```
SocSim-Lab/
├── start.bat          # 一键启动脚本
├── stop.bat           # 停止服务脚本
├── backend/           # FastAPI 后端
│   ├── main.py        # 后端入口
│   ├── requirements.txt
│   └── venv/          # Python 虚拟环境
├── frontend/          # React 前端
│   ├── src/
│   ├── package.json
│   └── node_modules/
└── data/              # SQLite 数据库
```
