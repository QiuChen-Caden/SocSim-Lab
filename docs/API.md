# SocSim Lab - API 接口文档

> **版本**: v3.0
> **更新日期**: 2026-02-06
> **Base URL**: `http://localhost:8000`
> **WebSocket**: `ws://localhost:8000/ws`

---

## 目录

1. [概述](#概述)
2. [认证](#认证)
3. [通用参数](#通用参数)
4. [响应格式](#响应格式)
5. [接口列表](#接口列表)
6. [数据模型](#数据模型)
7. [WebSocket 协议](#websocket-协议)
8. [错误码](#错误码)

---

## 概述

SocSim Lab API 提供完整的社交模拟后端服务，基于 FastAPI 框架实现，支持：

- 智能体管理 (Agent)
- 信息流管理 (Feed)
- 模拟状态控制 (Simulation)
- 时间线事件 (Events)
- 日志管理 (Logs)
- 快照系统 (Snapshots)
- 书签管理 (Bookmarks)
- 干预功能 (Intervention)
- 可视化布局 (Visualization)
- WebSocket 实时通信

### 技术特性

| 特性 | 说明 |
|------|------|
| 框架 | FastAPI 0.109.0 |
| 数据库 | SQLite3 + SQLAlchemy ORM |
| 实时通信 | WebSocket |
| API 文档 | Swagger / ReDoc |

### 文档地址

| 文档类型 | 地址 |
|---------|------|
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |

---

## 认证

**当前版本**: API 无需认证，所有端点完全开放。

**未来规划**: 将支持 API Key 和 JWT 认证。

---

## 通用参数

### 查询参数

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `limit` | integer | 50/100 | 返回数量限制 |
| `offset` | integer | 0 | 分页偏移量 |
| `sort` | string | - | 排序方式 (time/emotion/likes) |

### 路径参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `{agent_id}` | integer | 智能体 ID (1-30) |
| `{snapshot_id}` | string | 快照唯一标识 |
| `{bookmark_id}` | string | 书签唯一标识 |

---

## 响应格式

### 成功响应

```json
{
  "status": "success",
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": { ... }
  }
}
```

---

## 接口列表

### 1. 基础端点

#### 1.1 根端点

```
GET /
```

获取 API 基础信息。

**响应示例**:
```json
{
  "name": "SocSim Lab API",
  "version": "3.0.0",
  "description": "社交模拟可视化平台 API",
  "documentation": "/docs"
}
```

---

#### 1.2 健康检查

```
GET /health
```

检查服务健康状态。

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-06T10:30:00Z",
  "database": "connected",
  "websocket": "available"
}
```

---

### 2. 智能体管理 (Agent)

#### 2.1 获取智能体列表

```
GET /api/agents
```

获取所有或指定的智能体信息。

**查询参数**:

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `ids` | string | 否 | 逗号分隔的 ID 列表，如 "1,2,3" |
| `limit` | integer | 否 | 返回数量限制 (默认: 50) |
| `offset` | integer | 否 | 分页偏移量 (默认: 0) |

**响应示例**:
```json
{
  "agents": [
    {
      "id": 1,
      "name": "twitter_user_001",
      "group": "GroupA",
      "identity": {
        "username": "@user001",
        "age_band": "25-34",
        "gender": "female",
        "location": {
          "country": "USA",
          "region_city": "New York"
        },
        "profession": "Journalist",
        "domain_of_expertise": ["media", "politics"]
      },
      "psychometrics": {
        "personality": {
          "big_five": { "O": 0.75, "C": 0.60, "E": 0.80, "A": 0.55, "N": 0.40 }
        },
        "values": {
          "moral_foundations": {
            "care": 0.80, "fairness": 0.75, "loyalty": 0.50,
            "authority": 0.45, "sanctity": 0.40
          }
        }
      },
      "social_status": {
        "influence_tier": "opinion_leader",
        "economic_band": "medium",
        "social_capital": { "network_size_proxy": 3 }
      },
      "behavior_profile": {
        "posting_cadence": { "posts_per_day": 3.5 },
        "rhetoric_style": { "civility": 0.75, "evidence_citation": 0.60 }
      },
      "cognitive_state": {
        "core_affect": { "sentiment": "calm", "arousal": 0.50 },
        "issue_stances": [
          { "issue": "climate_change", "position": 0.80, "confidence": 0.90 }
        ]
      }
    }
  ],
  "total": 30,
  "limit": 50,
  "offset": 0
}
```

---

#### 2.2 获取单个智能体

```
GET /api/agents/{agent_id}
```

获取指定智能体的完整信息。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `agent_id` | integer | 智能体 ID (1-30) |

**响应**: 同 [2.1](#21-获取智能体列表) 中的单个智能体对象

---

#### 2.3 获取智能体状态

```
GET /api/agents/{agent_id}/state
```

获取智能体的当前状态。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `agent_id` | integer | 智能体 ID |

**响应示例**:
```json
{
  "agent_id": 1,
  "state": {
    "mood": 0.35,
    "stance": 0.60,
    "resources": 0.75,
    "lastAction": "posted_message",
    "evidence": {
      "memoryHits": [],
      "reasoningSummary": "Recent positive interactions",
      "toolCalls": []
    }
  },
  "tick": 1234,
  "timestamp": "2026-02-06T10:30:00Z"
}
```

---

#### 2.4 更新智能体状态

```
PATCH /api/agents/{agent_id}/state
```

更新智能体的状态值。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `agent_id` | integer | 智能体 ID |

**请求体**:
```json
{
  "mood": 0.5,
  "stance": 0.8,
  "resources": 0.9,
  "lastAction": "intervention_applied"
}
```

**字段说明**:

| 字段 | 类型 | 范围 | 必填 | 描述 |
|------|------|------|------|------|
| `mood` | float | -1.0 ~ 1.0 | 否 | 情绪值 (负=消极, 正=积极) |
| `stance` | float | -1.0 ~ 1.0 | 否 | 立场值 (负=反对, 正=支持) |
| `resources` | float | 0.0 ~ 1.0 | 否 | 资源量 |
| `lastAction` | string | - | 否 | 最近执行的动作 |

**响应示例**:
```json
{
  "status": "success",
  "agent_id": 1,
  "updated_fields": ["mood", "stance"],
  "new_state": { "mood": 0.5, "stance": 0.8 }
}
```

---

### 3. 信息流管理 (Feed)

#### 3.1 获取信息流

```
GET /api/feed
```

获取智能体发布的帖子列表。

**查询参数**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `limit` | integer | 50 | 返回数量 |
| `offset` | integer | 0 | 偏移量 |
| `sort` | string | "time" | 排序方式: `time`/`emotion`/`likes` |

**响应示例**:
```json
{
  "posts": [
    {
      "id": "post_123456",
      "tick": 1234,
      "author_id": 1,
      "author_name": "twitter_user_001",
      "emotion": 0.65,
      "content": "Great discussion today! #socialsim",
      "likes": 12,
      "timestamp": "2026-02-06T10:30:00Z"
    }
  ],
  "total": 250,
  "limit": 50,
  "offset": 0,
  "sort": "time"
}
```

---

#### 3.2 创建帖子

```
POST /api/feed
```

创建新的信息流帖子。

**请求体**:
```json
{
  "agent_id": 1,
  "content": "This is a test post",
  "emotion": 0.5
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `agent_id` | integer | 是 | 作者智能体 ID |
| `content` | string | 是 | 帖子内容 (1-500 字符) |
| `emotion` | float | 否 | 情绪值 -1~1 (默认自动计算) |

**响应**: 返回创建的帖子对象，同 [3.1](#31-获取信息流)

---

### 4. 模拟状态管理 (Simulation State)

#### 4.1 获取模拟状态

```
GET /api/state
```

获取当前模拟的整体状态。

**响应示例**:
```json
{
  "config": {
    "seed": 42,
    "agent_count": 30,
    "world_size": 2000,
    "ticks_per_second": 2,
    "sample_agents": 500
  },
  "tick": 1234,
  "is_running": true,
  "speed": 1.0,
  "selected_agent_id": 1,
  "agents": { "1": { ... } },
  "groups": { "GroupA": { ... } },
  "timestamp": "2026-02-06T10:30:00Z"
}
```

---

#### 4.2 更新模拟状态

```
PATCH /api/state
```

更新模拟运行状态。

**请求体**:
```json
{
  "is_running": true,
  "speed": 2.0,
  "tick": 1500,
  "selected_agent_id": 5
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `is_running` | boolean | 否 | 运行状态 |
| `speed` | float | 否 | 播放速度 (0.1-10.0) |
| `tick` | integer | 否 | 当前时间步 |
| `selected_agent_id` | integer | 否 | 选中的智能体 ID |

---

### 5. 模拟控制 (Simulation Control)

#### 5.1 启动模拟

```
POST /api/simulation/start
```

启动模拟运行。

**请求体** (可选):
```json
{
  "speed": 1.0
}
```

**响应示例**:
```json
{
  "status": "started",
  "tick": 1235,
  "speed": 1.0,
  "timestamp": "2026-02-06T10:30:01Z"
}
```

---

#### 5.2 停止模拟

```
POST /api/simulation/stop
```

停止模拟运行并重置。

**响应示例**:
```json
{
  "status": "stopped",
  "tick": 0,
  "timestamp": "2026-02-06T10:30:05Z"
}
```

---

#### 5.3 暂停模拟

```
POST /api/simulation/pause
```

暂停模拟运行。

**响应示例**:
```json
{
  "status": "paused",
  "tick": 1500,
  "timestamp": "2026-02-06T10:30:03Z"
}
```

---

#### 5.4 恢复模拟

```
POST /api/simulation/resume
```

恢复暂停的模拟。

**响应**: 同 [5.1](#51-启动模拟)

---

#### 5.5 设置速度

```
PUT /api/simulation/speed
```

设置模拟播放速度。

**请求体**:
```json
{
  "speed": 2.5
}
```

**参数说明**:

| 参数 | 类型 | 范围 | 描述 |
|------|------|------|------|
| `speed` | float | 0.1 ~ 10.0 | 播放速度倍率 |

**响应示例**:
```json
{
  "status": "success",
  "speed": 2.5,
  "previous_speed": 1.0
}
```

---

#### 5.6 设置时间步

```
POST /api/simulation/tick
```

跳转到指定时间步。

**请求体**:
```json
{
  "tick": 2000
}
```

**响应示例**:
```json
{
  "status": "success",
  "tick": 2000,
  "previous_tick": 1500
}
```

---

### 6. 时间线事件 (Events)

#### 6.1 获取事件列表

```
GET /api/events
```

获取时间线事件。

**查询参数**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `limit` | integer | 100 | 返回数量 |
| `offset` | integer | 0 | 偏移量 |
| `type` | string | - | 事件类型过滤 |

**响应示例**:
```json
{
  "events": [
    {
      "id": "evt_123456",
      "tick": 1234,
      "type": "agent_action",
      "agent_id": 1,
      "title": "Agent posted message",
      "payload": {
        "action": "post",
        "content": "Hello world!"
      },
      "timestamp": "2026-02-06T10:30:00Z"
    }
  ],
  "total": 500,
  "limit": 100,
  "offset": 0
}
```

**事件类型**:

| 类型 | 描述 |
|------|------|
| `agent_action` | 智能体行为 |
| `message` | 消息发布 |
| `intervention` | 干预操作 |
| `alert` | 系统警告 |
| `bookmark` | 手动书签 |

---

#### 6.2 创建事件

```
POST /api/events
```

创建新的时间线事件。

**请求体**:
```json
{
  "tick": 1234,
  "type": "intervention",
  "title": "Admin intervention",
  "agent_id": 5,
  "payload": {
    "command": "set mood",
    "value": 0.8
  }
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `tick` | integer | 是 | 发生时间步 |
| `type` | string | 是 | 事件类型 |
| `title` | string | 是 | 事件标题 |
| `agent_id` | integer | 否 | 相关智能体 ID |
| `payload` | object | 否 | 事件附加数据 |

---

### 7. 日志管理 (Logs)

#### 7.1 获取日志

```
GET /api/logs
```

获取模拟运行日志。

**查询参数**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `limit` | integer | 100 | 返回数量 |
| `offset` | integer | 0 | 偏移量 |
| `level` | string | - | 日志级别: `info`/`warn`/`error` |

**响应示例**:
```json
{
  "logs": [
    {
      "id": "log_123456",
      "tick": 1234,
      "level": "info",
      "text": "Agent 1 posted a message",
      "agent_id": 1,
      "timestamp": "2026-02-06T10:30:00Z"
    }
  ],
  "total": 1000,
  "limit": 100,
  "offset": 0
}
```

---

#### 7.2 创建日志

```
POST /api/logs
```

创建新的日志条目。

**请求体**:
```json
{
  "tick": 1234,
  "level": "info",
  "text": "Simulation started",
  "agent_id": null
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `tick` | integer | 是 | 时间步 |
| `level` | string | 是 | 日志级别 |
| `text` | string | 是 | 日志内容 |
| `agent_id` | integer | 否 | 相关智能体 ID |

---

### 8. 快照系统 (Snapshots)

#### 8.1 获取快照列表

```
GET /api/snapshots
```

获取所有保存的快照。

**响应示例**:
```json
{
  "snapshots": [
    {
      "id": "snap_123456",
      "name": "Experiment 1 - Initial State",
      "tick": 500,
      "created_at": "2026-02-06T09:00:00Z",
      "description": "Initial state before intervention"
    }
  ],
  "total": 5
}
```

---

#### 8.2 创建快照

```
POST /api/snapshots
```

保存当前模拟状态为快照。

**请求体**:
```json
{
  "name": "Critical Moment - polarization high"
}
```

**响应示例**:
```json
{
  "id": "snap_789012",
  "name": "Critical Moment - polarization high",
  "tick": 1500,
  "created_at": "2026-02-06T10:30:00Z",
  "status": "created"
}
```

---

#### 8.3 获取快照详情

```
GET /api/snapshots/{snapshot_id}
```

获取指定快照的详细信息。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `snapshot_id` | string | 快照 ID |

**响应示例**:
```json
{
  "id": "snap_789012",
  "name": "Critical Moment",
  "tick": 1500,
  "created_at": "2026-02-06T10:30:00Z",
  "state": {
    "agents": { ... },
    "groups": { ... },
    "feed": [ ... ]
  }
}
```

---

#### 8.4 加载快照

```
POST /api/snapshots/{snapshot_id}/load
```

将模拟状态恢复到快照时刻。

**响应示例**:
```json
{
  "status": "loaded",
  "snapshot_id": "snap_789012",
  "tick": 1500,
  "timestamp": "2026-02-06T10:35:00Z"
}
```

---

#### 8.5 删除快照

```
DELETE /api/snapshots/{snapshot_id}
```

删除指定快照。

**响应示例**:
```json
{
  "status": "deleted",
  "snapshot_id": "snap_789012"
}
```

---

### 9. 书签管理 (Bookmarks)

#### 9.1 获取书签列表

```
GET /api/bookmarks
```

获取所有时间轴书签。

**响应示例**:
```json
{
  "bookmarks": [
    {
      "id": "bkm_123456",
      "tick": 1000,
      "note": "First intervention applied",
      "created_at": "2026-02-06T10:00:00Z"
    }
  ],
  "total": 3
}
```

---

#### 9.2 创建书签

```
POST /api/bookmarks
```

在当前时间步添加书签。

**请求体**:
```json
{
  "tick": 1500,
  "note": "High polarization point"
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `tick` | integer | 是 | 时间步 |
| `note` | string | 否 | 书签备注 |

**响应**: 返回创建的书签对象

---

#### 9.3 删除书签

```
DELETE /api/bookmarks/{bookmark_id}
```

删除指定书签。

**路径参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `bookmark_id` | string | 书签 ID |

**响应示例**:
```json
{
  "status": "deleted",
  "bookmark_id": "bkm_123456"
}
```

---

### 10. 干预功能 (Intervention)

#### 10.1 创建干预

```
POST /api/intervention
```

对模拟执行干预操作。

**请求体**:
```json
{
  "tick": 1234,
  "command": "set agent 5 mood=0.8",
  "target_agent_id": 5
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `tick` | integer | 是 | 执行时间步 |
| `command` | string | 是 | 干预命令 |
| `target_agent_id` | integer | 否 | 目标智能体 ID |

**支持的命令**:

| 命令格式 | 描述 |
|---------|------|
| `pause` / `resume` | 暂停/恢复模拟 |
| `set agent <id> mood=<value>` | 设置智能体情绪 |
| `inject event: <text>` | 注入事件 |
| `set speed=<value>` | 设置播放速度 |

**响应示例**:
```json
{
  "id": "int_123456",
  "status": "executed",
  "tick": 1234,
  "command": "set agent 5 mood=0.8",
  "result": {
    "agent_id": 5,
    "previous_mood": 0.3,
    "new_mood": 0.8
  }
}
```

---

### 11. 可视化 (Visualization)

#### 11.1 获取布局

```
GET /api/visualization/layout
```

获取智能体的 2D 布局坐标。

**查询参数**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `algorithm` | string | "force_directed" | 布局算法 |

**支持的算法**:

| 算法 | 描述 |
|------|------|
| `force_directed` | 力导向布局 |
| `circular` | 环形布局 |
| `grid` | 网格布局 |
| `random` | 随机布局 |

**响应示例**:
```json
{
  "algorithm": "force_directed",
  "agents": [
    {
      "id": 1,
      "x": 500.5,
      "y": 300.2
    },
    {
      "id": 2,
      "x": 520.8,
      "y": 310.5
    }
  ],
  "bounds": {
    "min_x": 0,
    "max_x": 1000,
    "min_y": 0,
    "max_y": 800
  }
}
```

---

## 数据模型

### AgentProfile (智能体画像)

```typescript
interface AgentProfile {
  id: number                    // 1-30
  name: string                  // 显示名称
  group: string                 // GroupA-E

  // 身份信息
  identity: {
    username: string
    age_band: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+' | 'unknown'
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
        O: number  // 0-1
        C: number  // 0-1
        E: number  // 0-1
        A: number  // 0-1
        N: number  // 0-1
      }
    }
    values: {
      moral_foundations: {
        care: number       // 0-1
        fairness: number   // 0-1
        loyalty: number    // 0-1
        authority: number  // 0-1
        sanctity: number   // 0-1
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
      civility: number        // 0-1
      evidence_citation: number  // 0-1
    }
  }

  // 认知状态
  cognitive_state: {
    core_affect: {
      sentiment: 'angry' | 'calm' | 'happy' | 'sad' | 'fearful' | 'surprised'
      arousal: number  // 0-1
    }
    issue_stances: Array<{
      issue: string
      position: number  // -1 to 1
      confidence: number  // 0-1
    }>
  }
}
```

### AgentState (智能体状态)

```typescript
interface AgentState {
  mood: number               // -1 to 1 (情绪)
  stance: number             // -1 to 1 (立场)
  resources: number          // 0 to 1 (资源)
  lastAction: string         // 上次动作
  evidence: {
    memoryHits: Array<{
      id: string
      text: string
      score: number
    }>
    reasoningSummary: string
    toolCalls: Array<{
      id: string
      name: string
      status: 'ok' | 'error'
      latencyMs: number
    }>
  }
}
```

### FeedPost (帖子)

```typescript
interface FeedPost {
  id: string
  tick: number
  author_id: number
  author_name: string
  emotion: number            // -1 to 1
  content: string
  likes: number
  timestamp: string          // ISO 8601
}
```

### TimelineEvent (时间线事件)

```typescript
interface TimelineEvent {
  id: string
  tick: number
  type: 'agent_action' | 'message' | 'intervention' | 'alert' | 'bookmark'
  agent_id?: number
  title: string
  payload?: Record<string, unknown>
  timestamp: string
}
```

---

## WebSocket 协议

### 连接

```
ws://localhost:8000/ws
```

### 消息格式

所有消息使用 JSON 格式：

```json
{
  "type": "message_type",
  "data": { ... }
}
```

### 客户端 → 服务器

#### 订阅事件

```json
{
  "type": "subscribe",
  "data": {
    "events": ["tick_update", "agent_update", "post_created"]
  }
}
```

#### 取消订阅

```json
{
  "type": "unsubscribe",
  "data": {
    "events": ["log_added"]
  }
}
```

#### 心跳

```json
{
  "type": "ping",
  "data": { "timestamp": 1234567890 }
}
```

### 服务器 → 客户端

#### 时间步更新

```json
{
  "type": "tick_update",
  "data": {
    "tick": 1235,
    "timestamp": "2026-02-06T10:30:01Z"
  }
}
```

#### 智能体更新

```json
{
  "type": "agent_update",
  "data": {
    "agent_id": 1,
    "state": {
      "mood": 0.45,
      "stance": 0.60,
      "resources": 0.75,
      "lastAction": "posted_message"
    }
  }
}
```

#### 帖子创建

```json
{
  "type": "post_created",
  "data": {
    "id": "post_123456",
    "tick": 1235,
    "author_id": 1,
    "content": "New post!",
    "emotion": 0.65
  }
}
```

#### 事件创建

```json
{
  "type": "event_created",
  "data": {
    "id": "evt_789012",
    "tick": 1235,
    "type": "agent_action",
    "title": "Agent 1 performed action"
  }
}
```

#### 日志添加

```json
{
  "type": "log_added",
  "data": {
    "id": "log_345678",
    "tick": 1235,
    "level": "info",
    "text": "Agent 1 posted a message",
    "agent_id": 1
  }
}
```

#### 模拟状态更新

```json
{
  "type": "simulation_state",
  "data": {
    "is_running": true,
    "speed": 1.0,
    "tick": 1235
  }
}
```

#### 错误

```json
{
  "type": "error",
  "data": {
    "code": "CONNECTION_ERROR",
    "message": "Lost connection to database"
  }
}
```

#### 心跳响应

```json
{
  "type": "pong",
  "data": { "timestamp": 1234567890 }
}
```

### 事件类型列表

| 类型 | 方向 | 描述 |
|------|------|------|
| `subscribe` | C→S | 订阅事件 |
| `unsubscribe` | C→S | 取消订阅 |
| `ping` | C→S | 心跳检测 |
| `pong` | S→C | 心跳响应 |
| `tick_update` | S→C | 时间步更新 |
| `agent_update` | S→C | 智能体状态更新 |
| `post_created` | S→C | 新帖子创建 |
| `event_created` | S→C | 时间线事件创建 |
| `log_added` | S→C | 日志添加 |
| `simulation_state` | S→C | 模拟状态更新 |
| `error` | S→C | 错误通知 |

---

## 错误码

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 422 | 参数验证失败 |
| 500 | 服务器内部错误 |

### 业务错误码

| 错误码 | 说明 |
|--------|------|
| `VALIDATION_ERROR` | 参数验证失败 |
| `NOT_FOUND` | 资源不存在 |
| `AGENT_NOT_FOUND` | 智能体不存在 |
| `SNAPSHOT_NOT_FOUND` | 快照不存在 |
| `BOOKMARK_NOT_FOUND` | 书签不存在 |
| `INVALID_COMMAND` | 无效的干预命令 |
| `SIMULATION_RUNNING` | 模拟正在运行 |
| `DATABASE_ERROR` | 数据库错误 |
| `WEBSOCKET_ERROR` | WebSocket 连接错误 |

### 错误响应示例

```json
{
  "status": "error",
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "智能体 ID 999 不存在",
    "details": {
      "agent_id": 999,
      "valid_range": "1-30"
    }
  }
}
```

---

## 使用示例

### Python 示例

```python
import requests

BASE_URL = "http://localhost:8000"

# 获取所有智能体
response = requests.get(f"{BASE_URL}/api/agents")
agents = response.json()["agents"]

# 启动模拟
response = requests.post(f"{BASE_URL}/api/simulation/start")
print(response.json())

# 创建干预
intervention = {
    "tick": 100,
    "command": "set agent 5 mood=0.8",
    "target_agent_id": 5
}
response = requests.post(f"{BASE_URL}/api/intervention", json=intervention)
print(response.json())
```

### JavaScript 示例

```javascript
const BASE_URL = 'http://localhost:8000';

// 获取所有智能体
async function getAgents() {
  const response = await fetch(`${BASE_URL}/api/agents`);
  const data = await response.json();
  return data.agents;
}

// 启动模拟
async function startSimulation() {
  const response = await fetch(`${BASE_URL}/api/simulation/start`, {
    method: 'POST'
  });
  return await response.json();
}

// 创建干预
async function createIntervention(tick, command, targetId) {
  const response = await fetch(`${BASE_URL}/api/intervention`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tick,
      command,
      target_agent_id: targetId
    })
  });
  return await response.json();
}
```

### WebSocket 示例

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onopen = () => {
  // 订阅事件
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: {
      events: ['tick_update', 'agent_update', 'post_created']
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'tick_update':
      console.log('Tick:', message.data.tick);
      break;
    case 'agent_update':
      console.log('Agent updated:', message.data.agent_id);
      break;
    case 'post_created':
      console.log('New post:', message.data.content);
      break;
  }
};

// 心跳
setInterval(() => {
  ws.send(JSON.stringify({
    type: 'ping',
    data: { timestamp: Date.now() }
  }));
}, 30000);
```

---

## 附录

### A. 状态转换图

```
模拟状态:
stopped → running → paused → running
    ↑                         ↓
    └─────────────────────────┘
```

### B. Tick 系统

- **定义**: 模拟的最小时间单位
- **范围**: 0 ~ ∞
- **递增**: 每次模拟步进自动增加
- **重置**: 停止模拟时重置为 0

### C. 情绪值映射

| 值范围 | 颜色 | 描述 |
|--------|------|------|
| -1.0 ~ -0.5 | 🔴 红色 | 强烈消极 |
| -0.5 ~ -0.2 | 🟠 橙色 | 轻微消极 |
| -0.2 ~ 0.2 | 🔵 蓝色 | 中性 |
| 0.2 ~ 0.5 | 🟢 绿色 | 轻微积极 |
| 0.5 ~ 1.0 | 🟩 深绿 | 强烈积极 |

---

**文档版本**: v3.0
**最后更新**: 2026-02-06
**维护者**: SocSim Lab Team
