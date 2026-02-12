# SocSim Lab

> 基于 Agent-Based Modeling (ABM) 的社会模拟可视化平台
> 版本：v3.2 | 更新：2026-02-12

---

## 项目简介

**SocSim Lab** 是一个社会模拟可视化平台，基于 Agent-Based Modeling (ABM) 方法研究社会动态、舆情传播和群体行为。

### 核心特性

| 特性 | 描述 |
|------|------|
| 🚀 **完整后端集成** | FastAPI + SQLite + WebSocket 实时通信 |
| 👥 **真实用户画像** | 30 个真实 Twitter 用户数据，包含心理测量模型 |
| 🎨 **高性能渲染** | PixiJS 支持 2000-50000 个智能体流畅可视化 |
| 📊 **数据可视化** | ECharts 图表、热力图、关系图谱 |
| 🎮 **实时干预** | 自然语言命令控制模拟运行 |

---

## 快速开始

### 前置要求

- **Python**: 3.10+ (不支持 OASIS 框架)
- **Node.js**: 18.0+
- **包管理器**: pip / npm

### 一键启动

> **Windows 用户**: 双击 `start.bat`
> **Linux/Mac 用户**: 运行 `chmod +x start.sh && ./start.sh`

### 手动启动

#### 1. 后端服务

```bash
cd backend
# 方式 A：Conda（推荐）
conda create -n socsim-env python=3.11 -y
conda run -n socsim-env python -m pip install -r requirements.txt

# 方式 B：venv（无 conda 时）
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 导入数据
OASIS_DB_PATH=../data/oasis_frontend.db
python import_personas.py --file ../twitter_personas_20260123_222506.json

# 启动服务（默认端口 8000）
python main.py
```

#### 2. 前端服务

```bash
cd frontend

# 安装依赖（首次运行）
npm install

# 启动开发服务器（默认端口 5173）
npm run dev

# 构建
npm run build
```

### 服务地址

| 服务 | 地址 |
|------|------|
| **前端** | http://localhost:5173 |
| **后端 API** | http://localhost:8000 |
| **Swagger 文档** | http://localhost:8000/docs |
| **WebSocket** | ws://localhost:8000/ws |

### LLM 配置（可选）

如需启用 LLM 功能，请设置环境变量：

```bash
# DeepSeek（默认）
set LLM_API_KEY=sk-your-deepseek-key

# OpenAI
set OPENAI_API_KEY=sk-your-openai-key

# AI365
set AI365_API_KEY=your-ai365-key
```

---

## 项目结构

```
SocSim-Lab/
├── frontend/                    # 前端服务 (React + Vite)
│   ├── src/
│   │   ├── app/                 # 应用核心逻辑
│   │   │   ├── SimulationProvider.tsx    # 模拟状态管理 (React Context + useReducer)
│   │   │   ├── state.ts                  # 状态定义与 reducer
│   │   │   ├── types.ts                 # TypeScript 类型定义
│   │   │   ├── util.ts                  # 工具函数
│   │   │   ├── persona.ts                # Twitter personas 数据处理
│   │   │   ├── agentGraph.ts             # 智能体关系图构建
│   │   │   ├── useMockEngine.ts          # Mock 模拟引擎
│   │   │   ├── useRealEngine.ts          # 真实 API 引擎
│   │   │   ├── api.ts                    # 后端 API 客户端
│   │   │   ├── components/              # 可复用组件
│   │   │   │   ├── ErrorBoundary.tsx      # React 错误边界
│   │   │   │   └── PixiWorld.tsx         # PixiJS 世界视图组件
│   │   ├── views/                    # 页面视图
│   │   │   ├── WorkbenchView.tsx         # 工作台（实验控制）
│   │   │   ├── WorldView.tsx            # 世界视图（2D 可视化）
│   │   │   ├── FeedView.tsx             # 社交信息流
│   │   │   └── ReplayView.tsx            # 系统日志查看器
│   │   ├── App.tsx                       # 应用入口
│   │   ├── main.tsx                      # React 挂载点
│   │   ├── styles.css                    # 全局样式
│   ├── package.json                      # 前端依赖
│   ├── vite.config.ts                   # Vite 配置（代理：/api -> http://127.0.0.1:8000）
│   └── index.html                      # HTML 入口
│
├── backend/                          # 后端服务 (FastAPI + SQLite)
│   ├── main.py                          # FastAPI 应用入口
│   ├── requirements.txt                  # Python 依赖
│   ├── .env.example                     # 环境变量示例
│   ├── models/                          # 数据模型（Pydantic）
│   │   ├── types.py                    # Python 类型定义
│   │   ├── database.py                 # 数据库操作（SQLAlchemy）
│   │   └── schema.py                   # 数据库架构
│   ├── algorithms/                      # 算法模块
│   │   ├── layout.py                  # 2D 布局算法
│   │   └── emotion.py               # 情绪分析
│   ├── websocket/                       # WebSocket 模块
│   │   └── manager.py              # 连接管理器
│   ├── schema/                          # 数据库架构
│   │   ├── extended_user.sql        # 扩展用户表结构
│   └── data/                         # 数据目录
│       └── oasis_frontend.db        # SQLite 数据库（运行时生成）
│
├── docs/                            # 文档
│   ├── PRD.md                         # 产品需求文档
│   └── README.md                      # 项目说明
│
├── start.bat                        # Windows 启动脚本
├── start.sh                          # Linux/Mac 启动脚本
└── README.md                         # 本文件
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|--------|
| **React** | 19.3.0 | UI 框架 |
| **TypeScript** | 5.8.3 | 类型系统 |
| **Vite** | 7.4.0 | 构建工具 |
| **PixiJS** | 8.15.0 | 2D 渲染引擎 |
| **pixi-viewport** | 6.0.3 | 视口管理（缩放/拖拽） |
| **ECharts** | 6.x | 图表可视化 |
| **FastAPI** | 0.115.0 | 后端 API 框架 |
| **SQLAlchemy** | 2.0+ | 数据库 ORM |
| **WebSocket** | - | 实时通信 |

---

## 核心功能

### 1. 工作台 (Workbench) 🛠️

完整的实验生命周期管理，包含四个核心阶段：

#### Design 设计阶段
- 场景配置：智能体数量、世界大小、时间步速度
- 约束设置：资源限制、行为规则
- 采样配置：渲染智能体数量（200-50000）

#### Run 运行阶段
- 启动/暂停/停止控制
- 实时控制台日志输出
- 流式日志展示（支持增量更新）
- 关键时刻书签标记

#### Intervene 干预阶段
- 自然语言命令输入
- 支持命令：
  - `pause / resume` - 暂停/恢复模拟
  - `set agent <id> mood=<value>` - 设置智能体情绪
  - `inject event: <text>` - 注入事件
  - `set speed=<value>` - 调整运行速度
- 干预历史记录追溯

#### Analyze 分析阶段
- 宏观指标：极化度、平均情绪、消息速率
- ECharts 图表可视化
- 事件流时间线
- 数据导出功能（CSV/JSON）

### 2. 世界视图 (World View) 🌍

基于 PixiJS 8.x 的高性能 2D 可视化：

#### 视图模式
- **微观模式**：显示单个智能体位置，通过颜色表示情绪状态
- **宏观模式**：网格热力图展示群体情绪分布

#### 交互操作
- **拖拽平移**：按住鼠标左键拖动画布
- **缩放**：鼠标滚轮或触控板手势
- **选择智能体**：点击任意位置选择最近智能体
- **惯性移动**：松开鼠标后平滑减速

#### 性能优化
- **Sprite 复用**：预生成点纹理，所有智能体共享
- **增量更新**：只在 tick 变化时更新位置
- **ResizeObserver**：响应式调整画布大小
- **StrictMode**：正确处理初始化竞态和销毁

### 3. 信息流 (Feed View) 📰

模拟社交媒体平台的信息展示：

#### 核心功能
- **帖子发布**：撰写并发布内容
- **多种排序**：
  - 最新优先 (Latest)
  - 最多点赞 (Most Liked)
  - 最具争议 (Most Controversial)
- **情绪可视化**：情绪强度条显示（-1 到 1）
- **交互操作**：
  - 点赞帖子
  - 跳转到作者详情
  - 跳转到发布时间点

### 4. 系统日志 (System Log) ⏮️

基于完整事件流的系统日志查看与时间轴回放：

#### 事件类型筛选
- `agent_action` - 智能体行为事件
- `message` - 消息发布事件
- `intervention` - 干预操作事件
- `alert` - 系统警告事件
- `bookmark` - 手动书签事件

#### 时间轴控制
- 播放/暂停/停止
- 时间滑块拖动跳转
- 速度调节：0.5x、1x、2x

### 5. 数据模型

基于真实 Twitter 用户画像的心理测量模型：

#### Big Five 大五人格
- **Openness (O)**: 开放性 (0-1)
- **Conscientiousness (C)**: 尽责性 (0-1)
- **Extraversion (E)**: 外向性 (0-1)
- **Agreeableness (A)**: 宜人性 (0-1)
- **Neuroticism (N)**: 神经质 (0-1)

#### Moral Foundations 道德基础
- **care/伤害**: 关怀/伤害
- **fairness/欺骗**: 公平/欺骗
- **loyalty/betrayal**: 忠诚/背叛
- **authority/subversion**: 权威/反叛
- **sanctity/degradation**: 神圣/堕落

#### 社会地位
- **影响力阶层**: 普通用户 | 意见领袖 | 精英
- **经济水平**: 低 | 中 | 高 | 未知
- **网络规模**: 社交网络大小代理值 (0-4+)

---

## 后端 API

### 端点总览

| 类别 | 端点 | 方法 | 描述 |
|------|------|--------|--------|
| **智能体** | `/api/agents` | GET/POST | 获取所有/创建智能体 |
| **智能体状态** | `/api/agents/{id}/state` | GET/PATCH | 获取/更新智能体状态 |
| **信息流** | `/api/feed` | GET/POST | 获取/创建帖子 |
| **模拟控制** | `/api/simulation/*` | POST | 启动/停止/控制 |
| **事件** | `/api/events` | GET/POST | 获取/创建事件 |
| **日志** | `/api/logs` | GET/POST | 获取/创建日志 |
| **快照** | `/api/snapshots` | GET/POST | 快照管理 |
| **书签** | `/api/bookmarks` | GET/POST/DELETE | 书签管理 |
| **干预** | `/api/intervention` | POST | 创建干预 |
| **可视化** | `/api/visualization/layout` | GET | 获取 2D 布局 |
| **WebSocket** | `/ws` | WS | 实时连接 |

### API 文档
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 配置说明

### 环境变量

后端 `.env` 文件配置项：

```bash
# 数据库路径
OASIS_DB_PATH=../data/oasis_frontend.db

# 运行时数据库路径（可选，默认覆盖上面的路径）
OASIS_RUNTIME_DB_PATH=../data/oasis_simulation_run.db

# API 配置
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# LLM 配置（可选）
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-xxxxx
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=512
LLM_TOP_P=1.0
LLM_ACTIVE_AGENTS=3

# 调试
DEBUG=false
```

### 前端模式

通过创建 `frontend/.env` 文件切换运行模式：

```bash
# Mock 模式（默认）
VITE_USE_REAL_API=false
VITE_API_URL=

# 真实 API 模式
VITE_USE_REAL_API=true
VITE_API_URL=http://localhost:8000
```

---

## 开发指南

### 前端开发

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 5173）
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 构建
npm run build

# 预览生产构建
npm run preview
```

### 后端开发

```bash
# 激活环境（首次）
# Windows: 使用 start.bat
# Linux/Mac: 使用 start.sh

# 手动激活
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 导入 personas 数据
python import_personas.py --file ../twitter_personas_20260123_222506.json

# 启动服务
python main.py

# 运行测试
pytest tests/
```

---

## 代码质量优化（v3.2）

### 已修复的问题

1. **类型安全**
   - 移除不必要的 `as any` 类型断言
   - 为 ECharts 回调添加正确的类型定义
   - 修复 WebSocket 消息队列类型处理

2. **性能优化**
   - FeedView 图表计算使用 Map 数据结构（O(1) 查找）
   - SimulationProvider actions 依赖修复
   - AgentGraph 组件添加 React.memo 包装
   - WebSocket 和 Set 清理优化

3. **内存泄漏修复**
   - 添加 Set 大小限制函数
   - 改进 WebSocket 断开清理
   - useEffect 清理函数完善

4. **错误处理**
   - PixiWorld 错误日志增强
   - JSON 解析添加验证
   - API 错误处理改进

5. **代码清理**
   - 移除未使用的 `USE_WEBSOCKET` 常量
   - 添加工具函数 JSDoc 文档

---

## 许可证

MIT License

---

## 作者与贡献

**SocSim Lab Team**

> GitHub: [SocSim-Lab](https://github.com/your-org/SocSim-Lab)

---

## 致谢

感谢使用 SocSim Lab！

如有问题或建议，欢迎提交 Issue 或 Pull Request。
