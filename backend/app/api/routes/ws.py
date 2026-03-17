from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.websocket_manager import ws_manager
from app.core.security import decode_token

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint. Connect with ?token=<jwt_token>"""
    # Verify token
    try:
        payload = decode_token(token, expected_type="access")
        factory_id = payload.get("fid")
        if not factory_id:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, factory_id)
    try:
        while True:
            # Keep connection alive, handle pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, factory_id)
