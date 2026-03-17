"""WebSocket connection manager for real-time updates."""
from fastapi import WebSocket
from typing import Dict, Set
import json


class ConnectionManager:
    """Manages WebSocket connections per factory."""

    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}  # factory_id -> connections

    async def connect(self, websocket: WebSocket, factory_id: int):
        await websocket.accept()
        if factory_id not in self.active_connections:
            self.active_connections[factory_id] = set()
        self.active_connections[factory_id].add(websocket)

    def disconnect(self, websocket: WebSocket, factory_id: int):
        if factory_id in self.active_connections:
            self.active_connections[factory_id].discard(websocket)

    async def broadcast_to_factory(self, factory_id: int, message: dict):
        """Broadcast a message to all connections in a factory."""
        if factory_id not in self.active_connections:
            return
        dead = set()
        for connection in self.active_connections[factory_id]:
            try:
                await connection.send_json(message)
            except Exception:
                dead.add(connection)
        for d in dead:
            self.active_connections[factory_id].discard(d)

    async def send_event(self, factory_id: int, event_type: str, data: dict):
        """Send a typed event to factory connections."""
        await self.broadcast_to_factory(factory_id, {
            "type": event_type,
            "data": data,
        })


ws_manager = ConnectionManager()
