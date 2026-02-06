"""
WebSocket connection manager for real-time updates.
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
    """A subscription to a specific event type."""
    event_types: Set[str] = field(default_factory=set)
    agent_ids: Set[int] = field(default_factory=set)


class WebSocketManager:
    """
    Manages WebSocket connections and broadcasts messages to subscribers.
    """

    def __init__(self):
        """Initialize the manager."""
        # Active connections: client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

        # Subscriptions: client_id -> Subscription
        self.subscriptions: Dict[str, Subscription] = {}

        # Client subscriptions by event type: event_type -> set of client_ids
        self.event_subscribers: Dict[str, Set[str]] = defaultdict(set)

        # Agent subscriptions: agent_id -> set of client_ids
        self.agent_subscribers: Dict[int, Set[str]] = defaultdict(set)

        # Message queue for broadcasting
        self.message_queue: asyncio.Queue = asyncio.Queue()

        # Broadcast task
        self._broadcast_task: Optional[asyncio.Task] = None

        # Event callbacks
        self._callbacks: Dict[str, Set[Callable]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None) -> str:
        """
        Connect a new WebSocket client.

        Args:
            websocket: The WebSocket connection
            client_id: Optional client ID (generated if not provided)

        Returns:
            The client ID
        """
        await websocket.accept()

        if client_id is None:
            client_id = str(uuid.uuid4())

        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = Subscription()

        # Send welcome message
        await self.send_personal_message({
            "type": "connected",
            "clientId": client_id,
            "timestamp": datetime.now().isoformat(),
        }, client_id)

        return client_id

    def disconnect(self, client_id: str) -> None:
        """
        Disconnect a client.

        Args:
            client_id: The client ID to disconnect
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]

        if client_id in self.subscriptions:
            # Clean up event subscriptions
            subscription = self.subscriptions[client_id]
            for event_type in subscription.event_types:
                self.event_subscribers[event_type].discard(client_id)

            # Clean up agent subscriptions
            for agent_id in subscription.agent_ids:
                self.agent_subscribers[agent_id].discard(client_id)

            del self.subscriptions[client_id]

    async def send_personal_message(self, message: dict, client_id: str) -> bool:
        """
        Send a message to a specific client.

        Args:
            message: The message to send (will be JSON serialized)
            client_id: The target client ID

        Returns:
            True if sent successfully, False otherwise
        """
        if client_id not in self.active_connections:
            return False

        try:
            websocket = self.active_connections[client_id]
            await websocket.send_json(message)
            return True
        except Exception as e:
            # Connection might be closed
            self.disconnect(client_id)
            return False

    async def broadcast(self, message: dict, event_type: Optional[str] = None) -> None:
        """
        Broadcast a message to all connected clients (or filtered by event type).

        Args:
            message: The message to broadcast
            event_type: Optional event type to filter subscribers
        """
        # Determine target clients
        if event_type and event_type in self.event_subscribers:
            target_clients = self.event_subscribers[event_type]
        else:
            target_clients = self.active_connections.keys()

        # Send to all target clients
        for client_id in list(target_clients):  # Copy to avoid modification during iteration
            await self.send_personal_message(message, client_id)

    async def broadcast_to_agent_subscribers(self, agent_id: int, message: dict) -> None:
        """
        Broadcast a message to clients subscribed to a specific agent.

        Args:
            agent_id: The agent ID
            message: The message to broadcast
        """
        if agent_id not in self.agent_subscribers:
            return

        for client_id in list(self.agent_subscribers[agent_id]):
            await self.send_personal_message(message, client_id)

    def subscribe(self, client_id: str, event_types: Optional[list[str]] = None,
                  agent_ids: Optional[list[int]] = None) -> None:
        """
        Subscribe a client to specific event types and/or agents.

        Args:
            client_id: The client ID
            event_types: Optional list of event types to subscribe to
            agent_ids: Optional list of agent IDs to subscribe to
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
        Unsubscribe a client from specific event types and/or agents.

        Args:
            client_id: The client ID
            event_types: Optional list of event types to unsubscribe from
            agent_ids: Optional list of agent IDs to unsubscribe from
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
        """Get the number of active connections."""
        return len(self.active_connections)

    def get_subscriber_count(self, event_type: Optional[str] = None,
                            agent_id: Optional[int] = None) -> int:
        """
        Get the number of subscribers.

        Args:
            event_type: Optional event type to count
            agent_id: Optional agent ID to count

        Returns:
            Number of subscribers
        """
        if event_type:
            return len(self.event_subscribers.get(event_type, set()))
        elif agent_id:
            return len(self.agent_subscribers.get(agent_id, set()))
        else:
            return len(self.active_connections)

    # Helper methods for specific event types
    async def emit_tick_update(self, tick: int, is_running: bool, speed: float) -> None:
        """Emit a tick update event."""
        await self.broadcast({
            "type": "tick_update",
            "tick": tick,
            "isRunning": is_running,
            "speed": speed,
            "timestamp": datetime.now().isoformat(),
        }, event_type="tick")

    async def emit_agent_update(self, agent_id: int, state: dict) -> None:
        """Emit an agent state update event."""
        await self.broadcast_to_agent_subscribers(agent_id, {
            "type": "agent_update",
            "agentId": agent_id,
            "state": state,
            "timestamp": datetime.now().isoformat(),
        })

    async def emit_post_created(self, post: dict) -> None:
        """Emit a post created event."""
        await self.broadcast({
            "type": "post_created",
            "post": post,
            "timestamp": datetime.now().isoformat(),
        }, event_type="post")

    async def emit_event_created(self, event: dict) -> None:
        """Emit a timeline event created."""
        await self.broadcast({
            "type": "event_created",
            "event": event,
            "timestamp": datetime.now().isoformat(),
        }, event_type="event")

    async def emit_log_added(self, log: dict) -> None:
        """Emit a log added event."""
        await self.broadcast({
            "type": "log_added",
            "log": log,
            "timestamp": datetime.now().isoformat(),
        }, event_type="log")

    async def emit_simulation_state(self, state: dict) -> None:
        """Emit full simulation state update."""
        await self.broadcast({
            "type": "simulation_state",
            "state": state,
            "timestamp": datetime.now().isoformat(),
        }, event_type="state")

    async def emit_error(self, error: str, details: Optional[dict] = None) -> None:
        """Emit an error event."""
        await self.broadcast({
            "type": "error",
            "error": error,
            "details": details,
            "timestamp": datetime.now().isoformat(),
        }, event_type="error")

    async def broadcast_system_log(self, log: dict) -> None:
        """Emit a system log event."""
        await self.broadcast({
            "type": "system_log",
            "log": log,
            "timestamp": datetime.now().isoformat(),
        }, event_type="system_log")

    # Event callbacks
    def on(self, event_type: str, callback: Callable) -> None:
        """Register a callback for an event type."""
        self._callbacks[event_type].add(callback)

    def off(self, event_type: str, callback: Callable) -> None:
        """Unregister a callback for an event type."""
        self._callbacks[event_type].discard(callback)

    async def emit(self, event_type: str, data: Any) -> None:
        """Emit an event to registered callbacks."""
        if event_type in self._callbacks:
            for callback in self._callbacks[event_type]:
                if asyncio.iscoroutinefunction(callback):
                    await callback(data)
                else:
                    callback(data)


# Global manager instance
manager = WebSocketManager()
