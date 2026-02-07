# SocSim Lab - LLM 智能体集成指南

> **文档版本**: v1.1
> **创建日期**: 2026-02-06
> **更新日期**: 2026-02-07
> **适用版本**: SocSim Lab v3.2+

---

## 目录

1. [概述](#概述)
2. [支持的 LLM 提供商](#支持的-llm-提供商)
3. [配置方式](#配置方式)
4. [API 参考](#api-参考)
5. [使用示例](#使用示例)
6. [性能优化](#性能优化)
7. [故障排除](#故障排除)

---

## 概述

SocSim Lab v3.1 引入了基于大语言模型（LLM）的智能体功能。通过集成 OASIS 社交模拟框架和 CAMEL 多智能体框架，智能体现在可以由 LLM 驱动，表现出更复杂、更自然的社会行为。

### 核心特性

- **多提供商支持**: OpenAI、DeepSeek、vLLM、本地部署
- **动态配置**: 运行时切换模型和参数
- **智能体选择**: 控制活跃 LLM 智能体数量
- **安全回退**: API 失败时自动回退到规则模式

### 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           WorkbenchView - LLM Configuration          │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │ REST API
┌─────────────────────────┼───────────────────────────────────┐
│                         │         Backend                    │
│  ┌──────────────────────┼───────────────────────────────┐  │
│  │          OasisSimulation (oasis_integration.py)      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │     Runtime Config (动态配置)                  │  │  │
│  │  │  - llm_enabled                                 │  │  │
│  │  │  - llm_provider                                │  │  │
│  │  │  - llm_model, llm_api_key, ...                │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                         │         OASIS Framework            │
│  ┌──────────────────────┼───────────────────────────────┐  │
│  │              SocialAgent (CAMEL)                    │  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  ModelFactory.create()                         │  │  │
│  │  │  - OpenAI / DeepSeek / vLLM / StubModel       │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                         │      LLM Providers                 │
│    OpenAI API    DeepSeek API    vLLM (Local)    Stub      │
└─────────────────────────────────────────────────────────────┘
```

---

## 支持的 LLM 提供商

### 1. OpenAI

**官方 API**: https://platform.openai.com

| 模型 | 上下文 | 特点 |
|------|--------|------|
| gpt-4o-mini | 128K | 快速、经济，适合对话 |
| gpt-4o | 128K | 最强能力，支持多模态 |
| gpt-3.5-turbo | 4K-16K | 经典模型，低成本 |

**配置示例**:
```json
{
  "llmProvider": "openai",
  "llmModel": "gpt-4o-mini",
  "llmBaseUrl": "https://api.openai.com/v1",
  "llmApiKey": "sk-...",
  "llmTemperature": 0.7,
  "llmMaxTokens": 512
}
```

**获取 API 密钥**:
1. 访问 https://platform.openai.com/api-keys
2. 创建新密钥或使用现有密钥
3. 复制密钥到配置中

### 2. DeepSeek

**官方 API**: https://platform.deepseek.com

| 模型 | 上下文 | 特点 |
|------|--------|------|
| deepseek-chat | 128K | 对话优化，中文友好 |
| deepseek-coder | 128K | 代码生成专用 |

**配置示例**:
```json
{
  "llmProvider": "deepseek",
  "llmModel": "deepseek-chat",
  "llmBaseUrl": "https://api.deepseek.com/v1",
  "llmApiKey": "sk-...",
  "llmTemperature": 0.7,
  "llmMaxTokens": 512
}
```

**获取 API 密钥**:
1. 访问 https://platform.deepseek.com/api_keys
2. 注册账号并创建密钥
3. 复制密钥到配置中

### 3. vLLM

**GitHub**: https://github.com/vllm-project/vllm

vLLM 支持本地或私有部署的开源模型，如 Llama、Mistral 等。

**配置示例**:
```json
{
  "llmProvider": "vllm",
  "llmModel": "meta-llama/Llama-3-8b",
  "llmBaseUrl": "https://api.deepseek.com/v1",
  "llmApiKey": "",
  "llmTemperature": 0.7,
  "llmMaxTokens": 512
}
```

**本地部署步骤**:
```bash
# 安装 vLLM
pip install vllm

# 启动 API 服务器
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3-8b \
  --host 0.0.0.0 \
  --port 8000
```

### 4. Stub (调试模式)

Stub 模式不调用实际 API，用于开发和测试。

**配置示例**:
```json
{
  "llmEnabled": false,
  "llmProvider": "stub"
}
```

---

## 配置方式

### 方式 1: 前端工作台配置

1. 打开应用，导航到 **Workbench** 页面
2. 在 **Design** 标签中找到 **LLM Configuration** 部分
3. 填写配置参数：
   - 勾选 **Enable LLM** 启用功能
   - 选择 **Provider**（提供商）
   - 输入 **Model**（模型名称）
   - 输入 **Base URL** 和 **API Key**
   - 调整生成参数（Temperature、Max Tokens、Top P）
   - 设置 **Active Agents**（活跃智能体数量）
4. 点击 **Apply** 保存配置

### 方式 2: 后端环境变量

在 `backend/.env` 文件中设置默认值：

```env
# LLM Configuration
LLM_ENABLED=false
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=your-api-key-here
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=512
LLM_TOP_P=1.0
LLM_ACTIVE_AGENTS=3
LLM_TIMEOUT_MS=30000
```

### 方式 3: REST API 更新

```bash
curl -X PATCH http://localhost:8000/api/state \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "llmEnabled": true,
      "llmProvider": "deepseek",
      "llmModel": "deepseek-chat",
      "llmBaseUrl": "https://api.deepseek.com/v1",
      "llmApiKey": "sk-...",
      "llmTemperature": 0.7,
      "llmMaxTokens": 512,
      "llmTopP": 1.0,
      "llmActiveAgents": 3
    }
  }'
```

---

## API 参考

### 配置参数

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `llmEnabled` | boolean | false | - | 是否启用 LLM 功能 |
| `llmProvider` | string | "deepseek" | - | 提供商标识 |
| `llmModel` | string | "deepseek-chat" | - | 模型名称 |
| `llmBaseUrl` | string | "https://api.deepseek.com/v1" | - | API 基础 URL |
| `llmApiKey` | string | "" | - | API 密钥 |
| `llmTemperature` | float | 0.7 | 0.0 - 1.0 | 生成随机性 |
| `llmMaxTokens` | int | 512 | 64 - 4096 | 最大输出令牌数 |
| `llmTopP` | float | 1.0 | 0.0 - 1.0 | Top-p 采样 |
| `llmActiveAgents` | int | 3 | 1 - 200 | 活跃 LLM 智能体数 |
| `llmTimeoutMs` | int | 30000 | 1000 - 120000 | 请求超时时间 |

### 生成参数说明

**Temperature (温度)**:
- **0.0 - 0.3**: 确定性输出，适合需要精确答案的场景
- **0.4 - 0.7**: 平衡创造性和一致性（推荐）
- **0.8 - 1.0**: 高度创造性，输出更多样

**Max Tokens (最大令牌数)**:
- 控制单次响应的最大长度
- 较小的值（64-256）适合简短回复
- 较大的值（512-4096）适合长文本生成

**Top P**:
- 0.9 - 1.0: 保持多样性（推荐）
- 0.5 - 0.9: 减少低概率词汇
- < 0.5: 非常保守的输出

### WebSocket 事件

当 LLM 智能体执行动作时，会通过 WebSocket 发送事件：

```typescript
{
  type: "llm_action",
  data: {
    agent_id: number,        // 智能体 ID
    action: string,          // 动作类型
    content: string,         // 生成内容
    model: string,           // 使用的模型
    tokens_used: number,     // 消耗的令牌数
    latency_ms: number       // 响应延迟（毫秒）
  }
}
```

---

## 使用示例

### 示例 1: 启用 DeepSeek 对话

```javascript
// 前端调用
fetch('http://localhost:8000/api/state', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: {
      llmEnabled: true,
      llmProvider: 'deepseek',
      llmModel: 'deepseek-chat',
      llmBaseUrl: 'https://api.deepseek.com/v1',
      llmApiKey: 'sk-your-api-key',
      llmTemperature: 0.7,
      llmMaxTokens: 512,
      llmActiveAgents: 5
    }
  })
})
```

### 示例 2: 切换到本地 vLLM

```javascript
fetch('http://localhost:8000/api/state', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: {
      llmEnabled: true,
      llmProvider: 'vllm',
      llmModel: 'meta-llama/Llama-3-8b',
      llmBaseUrl: 'https://api.deepseek.com/v1',
      llmApiKey: '',
      llmTemperature: 0.8,
      llmMaxTokens: 256,
      llmActiveAgents: 10
    }
  })
})
```

### 示例 3: 禁用 LLM（回退到规则模式）

```javascript
fetch('http://localhost:8000/api/state', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: {
      llmEnabled: false
    }
  })
})
```

---

## 性能优化

### 1. 活跃智能体数量

根据 API 速率限制和性能需求调整：

| 场景 | 推荐 `llmActiveAgents` |
|------|------------------------|
| 开发测试 | 1-3 |
| 小规模模拟 | 3-10 |
| 中等规模 | 10-50 |
| 大规模模拟 | 50-200（需本地部署） |

### 2. 令牌限制

设置合理的 `llmMaxTokens` 以控制成本和延迟：

| 场景 | 推荐 `llmMaxTokens` |
|------|-------------------|
| 简短回复 | 64-128 |
| 标准对话 | 256-512 |
| 长文本生成 | 1024-2048 |

### 3. 批处理

OASIS 框架会自动批处理多个智能体的请求，以提高效率。

### 4. 缓存

智能体决策会缓存在状态中，减少重复 API 调用。

---

## 故障排除

### 问题 1: API 密钥无效

**错误信息**: `AuthenticationError: Incorrect API key provided`

**解决方案**:
1. 检查 API 密钥是否正确复制
2. 确认密钥未过期或被撤销
3. 检查密钥权限是否包含所需的 API

### 问题 2: 请求超时

**错误信息**: `Timeout error after 30000ms`

**解决方案**:
1. 增加 `llmTimeoutMs` 参数值
2. 检查网络连接
3. 考虑使用更快的模型或本地部署

### 问题 3: 速率限制

**错误信息**: `Rate limit exceeded`

**解决方案**:
1. 减少 `llmActiveAgents` 数量
2. 增加 API 速率限制配额
3. 使用本地 vLLM 部署

### 问题 4: 模型不支持

**错误信息**: `Model not found or not supported`

**解决方案**:
1. 确认模型名称正确
2. 检查提供商是否支持该模型
3. 查看提供商文档获取可用模型列表

### 问题 5: 回退到 Stub 模式

**日志信息**: `[OASIS] LLM backend creation failed, falling back to StubModel`

**解决方案**:
1. 检查配置参数是否完整
2. 验证 API 可访问性
3. 查看完整错误日志获取详细信息

---

## 附录

### A. 支持的模型列表

#### OpenAI
- gpt-4o
- gpt-4o-mini
- gpt-4-turbo
- gpt-3.5-turbo

#### DeepSeek
- deepseek-chat
- deepseek-coder

#### vLLM (开源模型)
- meta-llama/Llama-3-8b
- meta-llama/Llama-3-70b
- mistralai/Mistral-7B
- 其他 HuggingFace 模型

### B. 相关文档

- [OASIS Framework](https://github.com/Oasis-OARC/OASIS)
- [CAMEL Framework](https://www.camel-ai.org/)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [vLLM 文档](https://docs.vllm.ai/)

### C. 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v1.0 | 2026-02-06 | 初始版本，支持 OpenAI/DeepSeek/vLLM |
| v1.1 | 2026-02-07 | 更新 API 地址为 8000 端口 |

---

**文档维护**: SocSim Lab Team
**最后更新**: 2026-02-07
