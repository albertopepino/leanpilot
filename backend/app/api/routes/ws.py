import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from app.services.websocket_manager import ws_manager
from app.core.security import decode_token
from app.db.session import async_session

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default="")):
    """WebSocket endpoint. Pass JWT token as ?token= query parameter."""
    # Authenticate BEFORE accepting the connection to prevent resource exhaustion
    if not token:
        await websocket.close(code=4001)
        return

    try:
        payload = await decode_token(token, expected_type="access")
        factory_id = payload.get("fid")
        user_id = payload.get("sub")
        if factory_id is None or not user_id:
            await websocket.close(code=4001)
            return

        # Validate user belongs to the claimed factory
        from app.models.user import User
        async with async_session() as db:
            result = await db.execute(
                select(User.factory_id).where(User.id == int(user_id), User.is_active == True)
            )
            row = result.first()
            if not row or row[0] != factory_id:
                await websocket.close(code=4003)
                return
    except Exception:
        await websocket.close(code=4001)
        return

    # Only accept after successful authentication
    await websocket.accept()
    await ws_manager.connect(websocket, factory_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, factory_id)
