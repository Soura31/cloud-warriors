from __future__ import annotations

import asyncio
import time
from typing import Optional

from .protocol import TYPE_PING, TYPE_PONG, decode_tlv, encode_tlv


class TcpServer:
    def __init__(self, node_id: str, host: str, port: int, keepalive_seconds: int = 15) -> None:
        self.node_id = node_id
        self.host = host
        self.port = port
        self.keepalive_seconds = keepalive_seconds
        self._server: Optional[asyncio.AbstractServer] = None

    async def start(self) -> None:
        self._server = await asyncio.start_server(self._handle_client, self.host, self.port, backlog=32)
        sockets = self._server.sockets or []
        if sockets:
            local = sockets[0].getsockname()
            print(f"[tcp] listening on {local[0]}:{local[1]}")

    async def stop(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peer = writer.get_extra_info("peername")
        print(f"[tcp] connection from {peer}")
        keepalive_task = asyncio.create_task(self._keepalive_loop(writer))
        try:
            while True:
                header = await reader.readexactly(5)
                msg_type = header[0]
                length = int.from_bytes(header[1:5], byteorder="big", signed=False)
                payload = await reader.readexactly(length)
                decoded_type, data = decode_tlv(header + payload)
                if decoded_type != msg_type:
                    continue
                if msg_type == TYPE_PING:
                    resp = encode_tlv(TYPE_PONG, {"ts": int(time.time()), "node_id": self.node_id})
                    writer.write(resp)
                    await writer.drain()
                    continue
                if msg_type == TYPE_PONG:
                    continue
                print(f"[tcp] msg type=0x{msg_type:02x} data={data}")
        except (asyncio.IncompleteReadError, ConnectionResetError):
            pass
        finally:
            keepalive_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await keepalive_task
            writer.close()
            await writer.wait_closed()
            print(f"[tcp] disconnected {peer}")

    async def _keepalive_loop(self, writer: asyncio.StreamWriter) -> None:
        while True:
            packet = encode_tlv(TYPE_PING, {"ts": int(time.time()), "node_id": self.node_id})
            writer.write(packet)
            await writer.drain()
            await asyncio.sleep(self.keepalive_seconds)


import contextlib

