# SocSim Lab - 社交模拟可视化平台

> **大规模社交模拟可视化平台**：百万级智能体渲染 · 实时干预控制 · 时间轴回放 · FastAPI 后端集成

## 项目简介

**SocSim Lab** 是一个基于多智能体模拟（Agent-Based Modeling）的社交动态可视化平台，采用前后端分离架构，帮助研究人员、数据科学家和策略制定者直观地研究社会现象、舆情传播和群体行为。

**核心特性**：
- 🚀 **完整后端集成**：FastAPI + SQLite + WebSocket 实时通信
- 👥 **真实用户画像**：30 个真实 Twitter 用户数据，包含心理测量模型
- 🎨 **高性能渲染**：PixiJS 支持 200-50000 个智能体流畅可视化
- 📊 **数据可视化**：ECharts 图表、热力图、关系图谱
- 🎮 **实时干预**：自然语言命令控制模拟运行

### 核心特性

- **OASIS 后端集成**：完整对接 OASIS 社交模拟平台
- **真实 Twitter Personas**：30 个真实提取的 Twitter 用户画像
- **心理测量数据**：大五人格、道德基础理论
- **REST + WebSocket**：完整的 API 支持
- **大规模数据渲染**：支持百万级智能体状态管理，采样渲染 200-50000 个智能体
- **高性能 2D 可视化**：基于 PixiJS 实现的世界视图，支持平滑缩放、拖拽、惯性移动
- **微观/宏观双模式**：
  - 微观模式：显示单个智能体位置，通过颜色表示情绪状态
  - 宏观模式：网格热力图展示群体情绪分布
- **流式日志系统**：实时增量展示模拟运行日志
- **干预控制台**：支持自然语言命令对模拟进行实时干预
- **时间轴回放**：基于事件流的时间跳转和状态重建
- **社交信息流**：模拟社交平台的 Feed 流展示，支持多种排序方式
- **快照系统**：保存和恢复模拟状态

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | ^19.2.0 | UI 框架 |
| TypeScript | ~5.9.3 | 类型系统 |
| Vite | ^7.2.4 | 构建工具 |
| PixiJS | ^8.15.0 | 2D 渲染引擎 |
| pixi-viewport | ^6.0.3 | 视口管理（缩放/拖拽） |
| ESLint | ^9.39.1 | 代码规范 |
| FastAPI | ^0.109.0 | 后端 API 服务 |
| SQLite3 | - | 数据库 |
| WebSocket | - | 实时通信 |

## 项目结构

```
SocSim-Lab/                      # 项目根目录
├── frontend/                    # 前端服务
│   ├── src/
│   │   ├── app/                 # 应用核心逻辑
│   │   │   ├── SimulationProvider.tsx    # 模拟状态管理
│   │   │   ├── state.ts                  # 初始状态定义
│   │   │   ├── types.ts                  # TypeScript 类型定义
│   │   │   ├── util.ts                   # 工具函数
│   │   │   ├── useMockEngine.ts          # 模拟引擎 Hook
│   │   │   ├── useRealEngine.ts          # 真实 API 引擎 Hook
│   │   │   ├── api.ts                    # 后端 API 客户端
│   │   │   ├── persona.ts                # Twitter personas 数据处理
│   │   │   └── agentGraph.ts             # 智能体关系图
│   │   ├── components/           # 可复用组件
│   │   │   ├── ErrorBoundary.tsx         # 错误边界
│   │   │   └── PixiWorld.tsx             # PixiJS 世界视图组件
│   │   ├── views/                # 页面视图
│   │   │   ├── WorkbenchView.tsx         # 工作台
│   │   │   ├── WorldView.tsx             # 世界视图
│   │   │   ├── FeedView.tsx              # 社交信息流
│   │   │   └── ReplayView.tsx            # 时间回放
│   │   ├── App.tsx                       # 应用入口
│   │   ├── main.tsx                      # React 挂载点
│   │   └── styles.css                    # 全局样式
│   ├── package.json              # 前端依赖
│   ├── vite.config.ts            # Vite 配置
│   └── index.html                # HTML 入口
│
├── backend/                     # 后端服务
│   ├── main.py                  # FastAPI 应用入口
│   ├── requirements.txt         # Python 依赖
│   ├── .env.example             # 环境变量示例
│   ├── import_personas.py       # Twitter personas 导入脚本
│   ├── models/                  # 数据模型
│   │   ├── types.py             # Python 类型定义
│   │   └── database.py          # 数据库操作
│   ├── algorithms/              # 算法模块
│   │   ├── layout.py            # 2D 布局算法
│   │   └── emotion.py           # 情绪分析
│   ├── websocket/               # WebSocket 模块
│   │   └── manager.py           # 连接管理器
│   ├── schema/                  # 数据库架构
│   │   └── extended_user.sql    # 扩展表结构
│   └── data/                    # 数据目录
│       └── oasis_frontend.db    # SQLite 数据库（运行时生成）
│
├── docs/                        # 文档
│   ├── PRD.md                   # 产品需求文档
│   └── README.md                # 文档说明
│
├── start.bat                    # Windows 启动脚本
├── start.sh                     # Linux/Mac 启动脚本
└── README.md                    # 项目说明
```

## 快速开始

### 方式一：一键启动（推荐）

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh && ./start.sh
```

启动脚本会自动完成以下操作：
1. 创建 Python 虚拟环境并安装依赖
2. 导入 Twitter personas 数据到 SQLite 数据库
3. 启动后端 API 服务（http://localhost:8000）
4. 启动前端开发服务器（http://localhost:5173）

### 方式二：手动启动

#### 后端服务

```bash
cd backend

# 创建虚拟环境（首次运行）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖（首次运行）
pip install -r requirements.txt

# 导入 Twitter personas 数据（首次运行）
python import_personas.py

# 启动后端服务
python main.py
```

后端服务：
- API 地址：http://localhost:8000
- Swagger 文档：http://localhost:8000/docs
- ReDoc 文档：http://localhost:8000/redoc
- WebSocket：ws://localhost:8000/ws

#### 前端服务

```bash
cd frontend

# 安装依赖（首次运行）
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

前端服务：http://localhost:5173

### Mock 模式 vs 真实 API

项目支持两种运行模式：

| 模式 | 配置 | 说明 |
|------|------|------|
| **Mock 模式**（默认） | `VITE_USE_REAL_API=false` | 使用前端模拟数据，无需后端 |
| **真实 API 模式** | `VITE_USE_REAL_API=true` | 连接 FastAPI 后端，支持数据持久化 |

创建 `frontend/.env` 文件切换模式：
```bash
VITE_USE_REAL_API=true
VITE_API_URL=http://localhost:8000
```

### 构建生产版本

```bash
cd frontend
npm run build
```

### 代码检查

```bash
cd frontend
npm run lint
```

### 预览生产构建

```bash
cd frontend
npm run preview
```

## 功能详解

### 1. Workbench 工作台 🛠️

实验全生命周期管理，包含四个核心阶段：

#### Design 设计阶段
- 场景配置：智能体数量、世界大小、时间步速度
- 约束设置：资源限制、行为规则
- 采样配置：渲染智能体数量（200-50000）
- 多标签页：Scenario、Pipeline、Groups、Config

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

### 2. World 世界视图 🌍

基于 PixiJS 8.x 的高性能 2D 可视化：

#### 交互操作
- **拖拽平移**：按住鼠标左键拖动画布
- **缩放**：鼠标滚轮或触控板手势
- **选择智能体**：点击任意位置选择最近智能体
- **惯性移动**：松开鼠标后平滑减速

#### 视图模式
**微观模式 (Micro)**：
- 显示单个智能体精灵
- 金色光环高亮选中智能体
- 颜色映射情绪：红色(消极) → 蓝色(中性) → 绿色(积极)

**宏观模式 (Macro)**：
- 网格热力图展示群体情绪分布
- 颜色深浅表示区域密度和平均情绪
- 适合观察大规模群体趋势

#### 性能特性
- 支持百万级智能体状态管理
- 采样渲染 200-50000 个智能体
- 60 FPS 流畅动画
- Sprite 复用和增量更新优化

### 3. Feed 信息流 📰

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

#### 指标仪表盘
- 基础统计：总帖子数、总点赞数、平均情绪
- 参与度指标：活跃用户、互动率
- 情绪分布：饼图展示情绪构成
- 极化指数：群体观点分化程度

### 4. Replay 回放 ⏮️

基于完整事件流的时间轴回放功能：

#### 时间轴控制
- 播放/暂停/停止
- 时间滑块拖动跳转
- 速度调节：0.5x、1x、2x
- 帧级控制：前进/后退 10 帧

#### 事件类型筛选
- `agent_action` - 智能体行为事件
- `message` - 消息发布事件
- `intervention` - 干预操作事件
- `alert` - 系统警告事件
- `bookmark` - 手动书签事件

#### 实验记录管理
- **快照系统**：保存任意时刻完整状态
- **书签管理**：标记关键时刻，添加备注
- **状态恢复**：一键加载历史快照
- **记录对比**：对比不同实验结果

## 数据模型

### Twitter Personas 数据结构

项目使用 30 个真实提取的 Twitter 用户画像，包含完整的多维度数据：

```typescript
interface AgentProfile {
  id: number                    // 智能体 ID (1-30)
  name: string                  // Twitter 用户名
  group: string                 // 所属群体 (Group A-E)

  // 身份信息
  identity: {
    username: string            // Twitter @username
    age_band: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'
    gender: 'male' | 'female' | 'unknown'
    location: {
      country: string
      region_city: string
    }
    profession: string
    domain_of_expertise: string[]
  }

  // 心理测量
  psychometrics: {
    personality: {
      big_five: {
        O: number  // Openness 开放性
        C: number  // Conscientiousness 尽责性
        E: number  // Extraversion 外向性
        A: number  // Agreeableness 宜人性
        N: number  // Neuroticism 神经质
      }
    }
    values: {
      moral_foundations: {
        care: number       // 关怀/伤害
        fairness: number   // 公平/欺骗
        loyalty: number    // 忠诚/背叛
        authority: number  // 权威/反叛
        sanctity: number   // 神圣/堕落
      }
    }
  }

  // 社会地位
  social_status: {
    influence_tier: 'ordinary_user' | 'opinion_leader' | 'elite'
    economic_band: 'low' | 'medium' | 'high' | 'unknown'
    social_capital: {
      network_size_proxy: number  // 0-4+
    }
  }

  // 行为画像
  behavior_profile: {
    posting_cadence: {
      posts_per_day: number
      diurnal_pattern: Array<{
        period: 'morning' | 'afternoon' | 'evening' | 'night'
        probability: number
      }>
    }
    rhetoric_style: {
      civility: number        // 文明度 0-1
      evidence_citation: number  // 证据引用 0-1
    }
  }

  // 认知状态
  cognitive_state: {
    core_affect: {
      sentiment: 'angry' | 'calm' | 'happy' | 'sad' | 'fearful' | 'surprised'
      arousal: number  // 唤醒度 0-1
    }
    issue_stances: Array<{
      issue: string
      position: number  // -1 (反对) ~ 1 (支持)
      confidence: number  // 0-1
    }>
  }
}

// 智能体状态
interface AgentState {
  mood: number               // 当前情绪 -1 ~ 1
  stance: number             // 立场 -1 ~ 1
  resources: number          // 资源量
  lastAction: string         // 最近行为
  evidence: Evidence         // 证据追踪
}
```

## 状态管理

项目使用 React Context + useReducer 模式管理全局模拟状态：

```typescript
// 状态结构
interface SimulationState {
  config: SimulationConfig
  tick: number
  isRunning: boolean
  speed: number
  selectedAgentId: number | null
  agents: Record<number, { profile: AgentProfile; state: AgentState }>
  logs: LogLine[]
  events: TimelineEvent[]
  feed: FeedPost[]
  interventions: InterventionRecord[]
}

// Action 类型
type SimulationAction =
  | { type: 'set_tick'; tick: number }
  | { type: 'toggle_run' }
  | { type: 'set_speed'; speed: number }
  | { type: 'set_selected_agent'; agentId: number | null }
  | { type: 'patch_agent'; agentId: number; patch: Partial<AgentState> }
  | { type: 'log_info'; text: string; agentId?: number }
  | { type: 'log_ok'; text: string; agentId?: number }
  | { type: 'log_error'; text: string; agentId?: number }
  | { type: 'push_event'; event: Omit<TimelineEvent, 'id'> }
  | { type: 'push_feed'; authorId: number; content: string; emotion: number }
  | { type: 'apply_intervention'; command: string; targetAgentId?: number }
  | { type: 'set_config'; config: Partial<SimulationConfig> }
```

## 性能优化

### PixiWorld 组件优化

1. **Sprite 复用**：预生成点纹理，所有智能体共享
2. **增量更新**：只在 tick 变化时更新位置
3. **ResizeObserver**：响应式调整画布大小
4. **StrictMode 兼容**：正确处理初始化竞态和销毁

### 渲染优化

- 采样渲染：百万级智能体中只渲染可配置数量（200-50000）
- 虚拟化：日志和事件列表限制显示数量
- 防抖：缩放事件使用 Pixi-viewport 内置优化

## 后端架构

### 技术栈
- **FastAPI 0.109.0**：现代化 Python Web 框架
- **SQLAlchemy + SQLite3**：数据库 ORM
- **WebSocket**：实时双向通信
- **NetworkX + SciPy**：网络分析和布局算法

### API 端点总览

| 类别 | 端点 | 方法 | 描述 |
|------|------|------|------|
| 智能体 | `/api/agents` | GET | 获取所有智能体 |
| 智能体 | `/api/agents/{id}` | GET | 获取单个智能体 |
| 智能体 | `/api/agents/{id}/state` | GET/PATCH | 获取/更新状态 |
| 信息流 | `/api/feed` | GET/POST | 获取/创建帖子 |
| 模拟 | `/api/simulation/start` | POST | 启动模拟 |
| 模拟 | `/api/simulation/stop` | POST | 停止模拟 |
| 模拟 | `/api/simulation/speed` | PUT | 设置速度 |
| 事件 | `/api/events` | GET/POST | 获取/创建事件 |
| 日志 | `/api/logs` | GET/POST | 获取/创建日志 |
| 快照 | `/api/snapshots` | GET/POST | 获取/创建快照 |
| 快照 | `/api/snapshots/{id}/load` | POST | 加载快照 |
| 书签 | `/api/bookmarks` | GET/POST/DELETE | 书签管理 |
| 干预 | `/api/intervention` | POST | 创建干预 |
| 可视化 | `/api/visualization/layout` | GET | 获取 2D 布局 |
| WebSocket | `/ws` | WS | 实时连接 |

### API 端点

| 类别 | 端点 | 方法 | 描述 |
|------|------|------|------|
| 智能体 | `/api/agents` | GET | 获取所有智能体 |
| 智能体 | `/api/agents/{id}` | GET | 获取单个智能体 |
| 智能体 | `/api/agents/{id}/state` | GET/PATCH | 获取/更新智能体状态 |
| 信息流 | `/api/feed` | GET/POST | 获取/创建帖子 |
| 状态 | `/api/state` | GET/PATCH | 获取/更新模拟状态 |
| 模拟 | `/api/simulation/start` | POST | 启动模拟 |
| 模拟 | `/api/simulation/stop` | POST | 停止模拟 |
| 模拟 | `/api/simulation/speed` | PUT | 设置速度 |
| 事件 | `/api/events` | GET/POST | 获取/创建事件 |
| 日志 | `/api/logs` | GET/POST | 获取/创建日志 |
| 快照 | `/api/snapshots` | GET/POST | 获取/创建快照 |
| 快照 | `/api/snapshots/{id}/load` | POST | 加载快照 |
| 书签 | `/api/bookmarks` | GET/POST/DELETE | 书签管理 |
| 干预 | `/api/intervention` | POST | 创建干预 |
| 可视化 | `/api/visualization/layout` | GET | 获取 2D 布局 |
| WebSocket | `/ws` | WS | 实时连接 |

### Twitter Personas 数据

项目包含 30 个真实提取的 Twitter 用户画像，数据结构：

```typescript
{
  identity: {
    username, age_band, gender, location,
    profession, domain_of_expertise
  },
  psychometrics: {
    personality: { big_five: { O, C, E, A, N } },
    values: { moral_foundations: { care, fairness, loyalty, authority, sanctity } }
  },
  social_status: { influence_tier, economic_band, social_capital },
  behavior_profile: { posting_cadence, rhetoric_style },
  cognitive_state: { core_affect, issue_stances }
}
```

源文件：`twitter_personas_20260123_222506.json`

## 扩展方向

### 可视化增强
- 网络关系图谱：展示智能体之间的社交连接
- 3D 视图模式：支持 Three.js 三维可视化
- 地理分布图：基于位置信息的空间展示
- 情绪趋势图：时间序列情绪变化

### 功能增强
- 批量干预：支持群体操作和条件干预
- 多实验对比：并行运行多个场景对比
- 数据导出：CSV、JSON、图片格式导出
- 报告生成：自动生成实验分析报告

### 系统优化
- 分布式渲染：Web Worker 后台计算
- 增量数据加载：按需加载历史数据
- 离线模式：Service Worker 缓存
- 多语言支持：i18n 国际化

## License

MIT

## 作者

SocSim Lab Team
