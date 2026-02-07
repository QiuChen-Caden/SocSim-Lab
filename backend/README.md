# OASIS 前端后端服务

OASIS 模拟平台与前端演示应用集成的后端 API 服务。

## 版本

**v3.2** | 最后更新：2026-02-07

## 功能特性

- **REST API**：完整的 REST API，支持智能体、信息流、状态、事件、日志、快照、书签和干预
- **WebSocket**：实时更新模拟 tick、智能体状态、帖子、事件和日志
- **扩展数据模型**：心理特征（大五人格、道德基础理论）、社会地位、行为档案、认知状态
- **2D 布局**：力导向和其他布局算法用于智能体可视化
- **情绪分析**：基于规则和词典的帖子情绪分析
- **快照系统**：保存和恢复模拟状态
- **书签系统**：标记和跳转到模拟关键时刻
- **SQLite 数据库**：嵌入式数据库，无需单独部署

## 安装

```bash
# Conda（推荐）
conda create -n socsim-py311 python=3.11 -y
conda run -n socsim-py311 python -m pip install -r requirements.txt
conda run -n socsim-py311 python -m pip install -e ../oasis-main

# venv 备选方案（Linux/Mac）
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e ../oasis-main
```

## 配置

在 backend 目录下创建 `.env` 文件：

```env
# 数据库（嵌入式 SQLite）
OASIS_DB_PATH=../data/oasis_frontend.db

# OASIS 运行时数据库（建议使用单独文件）
OASIS_RUNTIME_DB_PATH=../data/oasis_simulation_run.db

# CORS（允许前端连接）
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# 调试模式
DEBUG=true

# API 设置
APP_NAME=OASIS Frontend Backend
VERSION=3.2.0

# LLM API 密钥（可选；启用 LLM 功能时需要）
LLM_API_KEY=your_api_key_here
```

## 运行

```bash
# 启动服务器
python main.py

# 或直接使用 uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**服务器地址**：`http://localhost:8000`

### Windows PowerShell

```powershell
Set-Location "C:\path\to\SocSim-Lab\backend"
$env:PYTHONIOENCODING = "utf-8"
.\venv\Scripts\python.exe .\main.py
```

## API 文档

服务器启动后，访问：
- Swagger UI：`http://localhost:8000/docs`
- ReDoc：`http://localhost:8000/redoc`

## API 端点

### 智能体（Agents）
- `GET /api/agents` - 获取所有智能体或按 ID 筛选
- `GET /api/agents/{agent_id}` - 获取单个智能体
- `GET /api/agents/{agent_id}/state` - 获取智能体状态
- `PATCH /api/agents/{agent_id}/state` - 更新智能体状态

### 信息流（Feed）
- `GET /api/feed` - 获取帖子
- `POST /api/feed` - 创建新帖子

### 状态（State）
- `GET /api/state` - 获取模拟状态
- `PATCH /api/state` - 更新模拟状态

### 模拟控制
- `POST /api/simulation/start` - 启动模拟
- `POST /api/simulation/stop` - 停止模拟
- `POST /api/simulation/pause` - 暂停模拟
- `POST /api/simulation/resume` - 恢复模拟
- `PUT /api/simulation/speed` - 设置速度
- `POST /api/simulation/tick` - 设置当前 tick

### 事件（Events）
- `GET /api/events` - 获取时间轴事件
- `POST /api/events` - 创建事件

### 日志（Logs）
- `GET /api/logs` - 获取模拟日志
- `POST /api/logs` - 创建日志条目

### 快照（Snapshots）
- `GET /api/snapshots` - 获取所有快照
- `POST /api/snapshots` - 创建快照
- `GET /api/snapshots/{snapshot_id}` - 获取快照
- `POST /api/snapshots/{snapshot_id}/load` - 加载快照
- `DELETE /api/snapshots/{snapshot_id}` - 删除快照

### 书签（Bookmarks）
- `GET /api/bookmarks` - 获取所有书签
- `POST /api/bookmarks` - 创建书签
- `DELETE /api/bookmarks/{bookmark_id}` - 删除书签

### 干预（Interventions）
- `GET /api/interventions` - 获取干预历史
- `POST /api/intervention` - 创建干预

### 可视化（Visualization）
- `GET /api/visualization/layout` - 获取 2D 智能体位置

### WebSocket
- `WS /ws` - WebSocket 连接，用于实时更新

## WebSocket 使用

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

// 订阅特定事件
ws.send(JSON.stringify({
  type: 'subscribe',
  eventTypes: ['tick', 'post', 'agent_update'],
  agentIds: [1, 2, 3]
}));

// 处理消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);

  // 消息类型：
  // - tick_update: {tick, isRunning, speed}
  // - agent_update: {agentId, state}
  // - post_created: {post}
  // - event_created: {event}
  // - log_added: {log}
};
```

## 数据库架构

后端扩展了 OASIS 数据库架构，包括：

- `user_big_five` - 大五人格特征
- `user_moral_foundations` - 道德基础评分
- `user_social_status` - 社会地位信息
- `user_behavior_profile` - 行为模式
- `user_cognitive_state` - 认知和情绪状态
- `user_issue_stance` - 议题立场
- `user_identity` - 扩展身份信息
- `user_group` - 群体分配和 2D 位置
- `post_emotion` - 帖子情绪评分
- `simulation_snapshot` - 快照存储
- `timeline_bookmark` - 时间轴书签
- `timeline_event` - 时间轴事件
- `simulation_log` - 模拟日志
- `simulation_state` - 全局模拟状态
- `intervention_record` - 干预记录

## 数据持久化

后端使用 **SQLite 嵌入式数据库**：

- **无需单独部署数据库**
- **数据库文件**：`data/oasis_frontend.db`（默认）
- **跨机器部署**：只需复制数据库文件
- **可配置路径**：设置 `OASIS_DB_PATH` 环境变量

## 目录结构

```
backend/
├── main.py              # FastAPI 应用
├── requirements.txt     # Python 依赖
├── README.md           # 本文件
├── .env                # 配置文件（需创建）
├── data/
│   └── oasis_frontend.db  # SQLite 数据库
├── schema/
│   └── extended_user.sql  # 扩展数据库架构
├── models/
│   ├── __init__.py
│   ├── types.py       # 数据类型定义
│   └── database.py    # 数据库操作
├── algorithms/
│   ├── __init__.py
│   ├── layout.py      # 2D 布局算法
│   └── emotion.py     # 情绪分析
└── websocket/
    ├── __init__.py
    └── manager.py     # WebSocket 连接管理器
```

## 开发

```bash
# 安装开发依赖
pip install -r requirements.txt

# 自动重载运行
uvicorn main:app --reload

# 运行测试（如可用）
pytest
```

## OASIS 集成

后端可以选择性地集成 OASIS 库。将 OASIS 路径添加到 Python 路径或安装它：

```bash
# 选项 1：添加到路径
export PYTHONPATH="${PYTHONPATH}:/path/to/oasis-main"

# 选项 2：开发模式安装
cd /path/to/oasis-main
pip install -e .
```

然后后端可以直接使用 OASIS 的模拟引擎。

## 许可证

此后端集成遵循与父项目相同的许可证。
