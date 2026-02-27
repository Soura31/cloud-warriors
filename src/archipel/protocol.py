import json
import struct
from typing import Any, Dict, Tuple


TYPE_HELLO = 0x01
TYPE_PEER_LIST = 0x02
TYPE_MSG = 0x03
TYPE_CHUNK_REQ = 0x04
TYPE_CHUNK_DATA = 0x05
TYPE_MANIFEST = 0x06
TYPE_ACK = 0x07

TYPE_PING = 0x10
TYPE_PONG = 0x11


def encode_tlv(msg_type: int, payload: Dict[str, Any]) -> bytes:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return struct.pack("!BI", msg_type, len(body)) + body


def decode_tlv(buffer: bytes) -> Tuple[int, Dict[str, Any]]:
    if len(buffer) < 5:
        raise ValueError("Buffer too short")
    msg_type, length = struct.unpack("!BI", buffer[:5])
    if len(buffer) != 5 + length:
        raise ValueError("Invalid payload length")
    data = json.loads(buffer[5:].decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Payload must be a JSON object")
    return msg_type, data

