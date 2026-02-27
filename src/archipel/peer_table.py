from __future__ import annotations

import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Dict, List


@dataclass
class PeerEntry:
    node_id: str
    ip: str
    tcp_port: int
    last_seen: float
    shared_files: List[str] = field(default_factory=list)
    reputation: float = 1.0


class PeerTable:
    def __init__(self) -> None:
        self._lock = Lock()
        self._peers: Dict[str, PeerEntry] = {}

    def upsert(self, node_id: str, ip: str, tcp_port: int) -> None:
        now = time.time()
        with self._lock:
            current = self._peers.get(node_id)
            if current is None:
                self._peers[node_id] = PeerEntry(
                    node_id=node_id,
                    ip=ip,
                    tcp_port=tcp_port,
                    last_seen=now,
                )
                return
            current.ip = ip
            current.tcp_port = tcp_port
            current.last_seen = now

    def remove_stale(self, timeout_seconds: int) -> List[str]:
        now = time.time()
        removed: List[str] = []
        with self._lock:
            for node_id in list(self._peers.keys()):
                if now - self._peers[node_id].last_seen > timeout_seconds:
                    removed.append(node_id)
                    del self._peers[node_id]
        return removed

    def all_rows(self) -> List[PeerEntry]:
        with self._lock:
            return sorted(self._peers.values(), key=lambda p: p.node_id)

