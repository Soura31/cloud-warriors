from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
import time
from typing import Dict

from .discovery import DiscoveryService
from .peer_table import PeerTable
from .protocol import TYPE_PING, encode_tlv
from .tcp_server import TcpServer


class Node:
    def __init__(
        self,
        tcp_port: int,
        node_id: str,
        hello_interval: int = 30,
        stale_timeout: int = 90,
        keepalive_seconds: int = 15,
    ) -> None:
        self.node_id = node_id
        self.tcp_port = tcp_port
        self.hello_interval = hello_interval
        self.stale_timeout = stale_timeout
        self.keepalive_seconds = keepalive_seconds

        self.peer_table = PeerTable()
        self.discovery = DiscoveryService(
            node_id=self.node_id,
            tcp_port=self.tcp_port,
            hello_interval=self.hello_interval,
        )
        self.tcp_server = TcpServer(node_id=self.node_id, host="0.0.0.0", port=self.tcp_port)
        self._peer_connections: Dict[str, asyncio.StreamWriter] = {}

    async def start(self) -> None:
        await self.tcp_server.start()
        await self.discovery.start(self._on_hello)

        tasks = [
            asyncio.create_task(self._stale_cleanup_loop()),
            asyncio.create_task(self._connect_peers_loop()),
            asyncio.create_task(self._print_table_loop()),
        ]
        print(f"[node] id={self.node_id[:16]}... tcp={self.tcp_port}")

        try:
            await asyncio.gather(*tasks)
        finally:
            for writer in list(self._peer_connections.values()):
                writer.close()
                await writer.wait_closed()
            await self.discovery.stop()
            await self.tcp_server.stop()

    def _on_hello(self, node_id: str, ip: str, tcp_port: int) -> None:
        self.peer_table.upsert(node_id=node_id, ip=ip, tcp_port=tcp_port)

    async def _stale_cleanup_loop(self) -> None:
        while True:
            removed = self.peer_table.remove_stale(timeout_seconds=self.stale_timeout)
            for node_id in removed:
                writer = self._peer_connections.pop(node_id, None)
                if writer:
                    writer.close()
                    await writer.wait_closed()
            await asyncio.sleep(3)

    async def _connect_peers_loop(self) -> None:
        while True:
            for peer in self.peer_table.all_rows():
                if peer.node_id in self._peer_connections:
                    continue
                try:
                    reader, writer = await asyncio.open_connection(peer.ip, peer.tcp_port)
                    self._peer_connections[peer.node_id] = writer
                    packet = encode_tlv(TYPE_PING, {"ts": int(time.time()), "node_id": self.node_id})
                    writer.write(packet)
                    await writer.drain()
                    asyncio.create_task(self._watch_connection(peer.node_id, reader, writer))
                except OSError:
                    continue
            await asyncio.sleep(2)

    async def _watch_connection(
        self,
        peer_node_id: str,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        try:
            while True:
                header = await reader.readexactly(5)
                length = int.from_bytes(header[1:5], byteorder="big", signed=False)
                await reader.readexactly(length)
        except (asyncio.IncompleteReadError, ConnectionResetError, OSError):
            pass
        finally:
            self._peer_connections.pop(peer_node_id, None)
            writer.close()
            await writer.wait_closed()

    async def _print_table_loop(self) -> None:
        while True:
            rows = self.peer_table.all_rows()
            print("\n[peer-table]")
            if not rows:
                print("  (empty)")
            for p in rows:
                age = int(time.time() - p.last_seen)
                print(f"  {p.node_id[:12]}... {p.ip}:{p.tcp_port} last_seen={age}s rep={p.reputation:.1f}")
            await asyncio.sleep(10)


def load_node_id(pub_key_path: str | None) -> str:
    if pub_key_path and os.path.exists(pub_key_path):
        with open(pub_key_path, "rb") as fh:
            content = fh.read().strip()
        return hashlib.sha256(content).hexdigest()
    seed = f"node-{os.getpid()}-{time.time()}".encode("utf-8")
    return hashlib.sha256(seed).hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Archipel Sprint 1 node")
    parser.add_argument("--tcp-port", type=int, default=7777)
    parser.add_argument("--pubkey", type=str, default=None)
    parser.add_argument("--hello-interval", type=int, default=30)
    parser.add_argument("--stale-timeout", type=int, default=90)
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    node_id = load_node_id(args.pubkey)
    node = Node(
        tcp_port=args.tcp_port,
        node_id=node_id,
        hello_interval=args.hello_interval,
        stale_timeout=args.stale_timeout,
    )
    await node.start()

