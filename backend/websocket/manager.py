"""
用于实时更新的 WebSocket 连接管理器。
"""
import json
import uuid
from typing import Dict, Set, Any, Optional, Callable
from dataclasses import dataclass, field
from collections import defaultdict
import asyncio
from datetime import datetime

from fastapi import WebSocket


@dataclass
class Subscription:
    """对特定事件类型的订阅。"""
    event_types: Set[str] = field(default_factory=set)
    agent_ids: Set[int] = field(default_factory=set)


class WebSocketManager:
    """
    管理 WebSocket 连接并向订阅者广播消息。
    """

    def __init__(self):
        """初始化管理器。"""
        # 活动连接：client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

        # 订阅：client_id -> Subscription
        self.subscriptions: Dict[str, Subscription] = {}

        # 按事件类型的客户端订阅：event_type -> client_ids 集合
        self.event_subscribers: Dict[str, Set[str]] = defaultdict(set)

        # 代理订阅：agent_id -> client_ids 集合
        self.agent_subscribers: Dict[int, Set[str]] = defaultdict(set)

        # 用于广播的消息队列
        self.message_queue: asyncio.Queue = asyncio.Queue()

        # 广播任务
        self._broadcast_task: Optional[asyncio.Task] = None

        # 事件回调
        self._callbacks: Dict[str, Set[Callable]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None) -> str:
        """
        连接新的 WebSocket 客户端。

        参数：
            websocket: WebSocket 连接
            client_id: 可选的客户端 ID（如果未提供则生成）

        返回：
            客户端 ID
        """
        await websocket.accept()

        if client_id is None:
            client_id = str(uuid.uuid4())

        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = Subscription()

        # 发送欢迎消息
        await self.send_personal_message({
            "type": "connected",
            "clientId": client_id,
            "timestamp": datetime.now().isoformat(),
        }, client_id)

        return client_id

    def disconnect(self, client_id: str) -> None:
        """
        断开客户端。

        参数：
            client_id: 要断开的客户端 ID
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]

        if client_id in self.subscriptions:
            # 清理事件订阅
            subscription = self.subscriptions[client_id]
            for event_type in subscription.event_types:
                self.event_subscribers[event_type].discard(client_id)

            # 清理代理订阅
            for agent_id in subscription.agent_ids:
                self.agent_subscribers[agent_id].discard(client_id)

            del self.subscriptions[client_id]

    async def send_personal_message(self, message: dict, client_id: str) -> bool:
        """
        向特定客户端发送消息。

        参数：
            message: 要发送的消息（将被序列化为 JSON）
            client_id: 目标客户端 ID

        返回：
            如果成功发送则为 True，否则为 False
        """
        if client_id not in self.active_connections:
            return False

        try:
            websocket = self.active_connections[client_id]
            await websocket.send_json(message)
            return True
        except Exception as e:
            # 连接可能已关闭
            self.disconnect(client_id)
            return False

    async def broadcast(self, message: dict, event_type: Optional[str] = None) -> None:
        """
        向所有连接的客户端广播消息（或按事件类型过滤）。

        参数：
            message: 要广播的消息
            event_type: 可选的事件类型以过滤订阅者
        """
        # 确定目标客户端
        if event_type and event_type in self.event_subscribers:
            target_clients = self.event_subscribers[event_type]
        else:
            target_clients = self.active_connections.keys()

        # 向所有目标客户端发送
        for client_id in list(target_clients):  # 复制以避免在迭代期间修改
            await self.send_personal_message(message, client_id)

    async def broadcast_to_agent_subscribers(self, agent_id: int, message: dict) -> None:
        """
        向订阅特定代理的客户端广播消息。

        参数：
            agent_id: 代理 ID
            message: 要广播的消息
        """
        if agent_id not in self.agent_subscribers:
            return

        for client_id in list(self.agent_subscribers[agent_id]):
            await self.send_personal_message(message, client_id)

    def subscribe(self, client_id: str, event_types: Optional[list[str]] = None,
                  agent_ids: Optional[list[int]] = None) -> None:
        """
        将客户端订阅到特定事件类型和/或代理。

        参数：
            client_id: 客户端 ID
            event_types: 要订阅的可选事件类型列表
            agent_ids: 要订阅的可选代理 ID 列表
        """
        if client_id not in self.subscriptions:
            return

        subscription = self.subscriptions[client_id]

        if event_types:
            for event_type in event_types:
                subscription.event_types.add(event_type)
                self.event_subscribers[event_type].add(client_id)

        if agent_ids:
            for agent_id in agent_ids:
                subscription.agent_ids.add(agent_id)
                self.agent_subscribers[agent_id].add(client_id)

    def unsubscribe(self, client_id: str, event_types: Optional[list[str]] = None,
                    agent_ids: Optional[list[int]] = None) -> None:
        """
        从特定事件类型和/或代理取消订阅客户端。

        参数：
            client_id: 客户端 ID
            event_types: 要取消订阅的可选事件类型列表
            agent_ids: 要取消订阅的可选代理 ID 列表
        """
        if client_id not in self.subscriptions:
            return

        subscription = self.subscriptions[client_id]

        if event_types:
            for event_type in event_types:
                subscription.event_types.discard(event_type)
                self.event_subscribers[event_type].discard(client_id)

        if agent_ids:
            for agent_id in agent_ids:
                subscription.agent_ids.discard(agent_id)
                self.agent_subscribers[agent_id].discard(client_id)

    def get_connection_count(self) -> int:
        """获取活动连接数。"""
        return len(self.active_connections)

    def get_subscriber_count(self, event_type: Optional[str] = None,
                            agent_id: Optional[int] = None) -> int:
        """
        获取订阅者数量。

        参数：
            event_type: 可选的要计数的事件类型
            agent_id: 可选的要计数的代理 ID

        返回：
            订阅者数量
        """
        if event_type:
            return len(self.event_subscribers.get(event_type, set()))
        elif agent_id:
            return len(self.agent_subscribers.get(agent_id, set()))
        else:
            return len(self.active_connections)

    # 用于特定事件类型的辅助方法
    async def emit_tick_update(self, tick: int, is_running: bool, speed: float) -> None:
        """发送 tick 更新事件。"""
        await self.broadcast({
            "type": "tick_update",
            "tick": tick,
            "isRunning": is_running,
            "speed": speed,
            "timestamp": datetime.now().isoformat(),
        }, event_type="tick")

    async def emit_agent_update(self, agent_id: int, state: dict) -> None:
        """发送代理状态更新事件。"""
        await self.broadcast_to_agent_subscribers(agent_id, {
            "type": "agent_update",
            "agentId": agent_id,
            "state": state,
            "timestamp": datetime.now().isoformat(),
        })

    async def emit_post_created(self, post: dict) -> None:
        """发送帖子创建事件。"""
        await self.broadcast({
            "type": "post_created",
            "post": post,
            "timestamp": datetime.now().isoformat(),
        }, event_type="post")

    async def emit_event_created(self, event: dict) -> None:
        """发送时间线事件创建。"""
        await self.broadcast({
            "type": "event_created",
            "event": event,
            "timestamp": datetime.now().isoformat(),
        }, event_type="event")

    async def emit_log_added(self, log: dict) -> None:
        """发送日志添加事件。"""
        await self.broadcast({
            "type": "log_added",
            "log": log,
            "timestamp": datetime.now().isoformat(),
        }, event_type="log")

    async def emit_simulation_state(self, state: dict) -> None:
        """发送完整仿真状态更新。"""
        await self.broadcast({
            "type": "simulation_state",
            "state": state,
            "timestamp": datetime.now().isoformat(),
        }, event_type="state")

    async def emit_error(self, error: str, details: Optional[dict] = None) -> None:
        """发送错误事件。"""
        await self.broadcast({
            "type": "error",
            "error": error,
            "details": details,
            "timestamp": datetime.now().isoformat(),
        }, event_type="error")

    async def broadcast_system_log(self, log: dict) -> None:
        """发送系统日志事件。"""
        await self.broadcast({
            "type": "system_log",
            "log": log,
            "timestamp": datetime.now().isoformat(),
        }, event_type="system_log")

    # Event callbacks
    def on(self, event_type: str, callback: Callable) -> None:
        """为事件类型注册回调。"""
        self._callbacks[event_type].add(callback)

    def off(self, event_type: str, callback: Callable) -> None:
        """取消注册事件类型的回调。"""
        self._callbacks[event_type].discard(callback)

    async def emit(self, event_type: str, data: Any) -> None:
        """向已注册的回调发送事件。"""
        if event_type in self._callbacks:
            for callback in self._callbacks[event_type]:
                if asyncio.iscoroutinefunction(callback):
                    await callback(data)
                else:
                    callback(data)


# Global manager instance
manager = WebSocketManager()
