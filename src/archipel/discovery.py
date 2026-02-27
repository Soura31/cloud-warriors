from __future__ import annotations

import asyncio
import json
import socket
import struct
import time
from typing import Callable, Optional


class _DiscoveryProtocol(asyncio.DatagramProtocol):
    def __init__(self, on_hello: Callable[[str, str, int], None], local_node_id: str) -> None:
        self.on_hello = on_hello
        self.local_node_id = local_node_id

    def datagram_received(self, data: bytes, addr) -> None:  # type: ignore[override]
        try:
            payload = json.loads(data.decode("utf-8"))
            if payload.get("type") != "HELLO":
                return
            node_id = str(payload["node_id"])
            if node_id == self.local_node_id:
                return
            tcp_port = int(payload["tcp_port"])
            self.on_hello(node_id, addr[0], tcp_port)
        except Exception:
            return


class DiscoveryService:
    def __init__(
        self,
        node_id: str,
        tcp_port: int,
        multicast_group: str = "239.255.42.99",
        multicast_port: int = 6000,
        hello_interval: int = 30,
    ) -> None:
        self.node_id = node_id
        self.tcp_port = tcp_port
        self.multicast_group = multicast_group
        self.multicast_port = multicast_port
        self.hello_interval = hello_interval

        self._transport: Optional[asyncio.DatagramTransport] = None
        self._sender_socket: Optional[socket.socket] = None
        self._task: Optional[asyncio.Task] = None

    async def start(self, on_hello: Callable[[str, str, int], None]) -> None:
        loop = asyncio.get_running_loop()
        recv_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        recv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        recv_sock.bind(("", self.multicast_port))

        mreq = struct.pack("=4s4s", socket.inet_aton(self.multicast_group), socket.inet_aton("0.0.0.0"))
        recv_sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

        self._transport, _ = await loop.create_datagram_endpoint(
            lambda: _DiscoveryProtocol(on_hello=on_hello, local_node_id=self.node_id),
            sock=recv_sock,
        )

        self._sender_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        self._sender_socket.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)
        self._task = asyncio.create_task(self._hello_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        if self._transport:
            self._transport.close()
        if self._sender_socket:
            self._sender_socket.close()

    async def _hello_loop(self) -> None:
        assert self._sender_socket is not None
        while True:
            message = {
                "type": "HELLO",
                "node_id": self.node_id,
                "tcp_port": self.tcp_port,
                "timestamp": int(time.time()),
            }
            data = json.dumps(message, separators=(",", ":")).encode("utf-8")
            self._sender_socket.sendto(data, (self.multicast_group, self.multicast_port))
            await asyncio.sleep(self.hello_interval)


import contextlib

