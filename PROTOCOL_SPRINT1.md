# Protocole Sprint 1 (Archipel H24)

## Objectif
Definir un protocole simple pour la communication entre 3 noeuds sur LAN:
- decouverte des pairs;
- echange de table de pairs;
- keepalive TCP.

## Transport
- UDP multicast pour la decouverte `HELLO`.
- TCP pour les messages TLV.

Valeurs par defaut:
- Multicast IP: `239.255.42.99`
- Multicast port: `6000`
- Ports TCP des noeuds: `7777`, `7778`, `7779`

## Encodage des messages (TLV)
Tous les messages TCP utilisent ce format binaire:

1. `TYPE` (1 octet)
2. `LENGTH` (4 octets, entier non signe big-endian)
3. `VALUE` (JSON UTF-8, longueur = `LENGTH`)

## Types de messages
- `0x01` `HELLO`
- `0x02` `PEER_LIST`
- `0x03` `MSG`
- `0x04` `CHUNK_REQ`
- `0x05` `CHUNK_DATA`
- `0x06` `MANIFEST`
- `0x07` `ACK`
- `0x10` `PING`
- `0x11` `PONG`

## Schema minimal des payloads
`HELLO`
```json
{
  "node_id": "node-a",
  "tcp_port": 7777,
  "shared_files": []
}
```

`PEER_LIST`
```json
{
  "peers": [
    {
      "node_id": "node-b",
      "ip": "192.168.10.2",
      "tcp_port": 7778,
      "last_seen": 1700000000,
      "shared_files": [],
      "reputation": 1.0
    }
  ]
}
```

`ACK`
```json
{
  "ok": true,
  "ref_type": "HELLO"
}
```

`PING`
```json
{
  "ts": 1700000000
}
```

`PONG`
```json
{
  "ts": 1700000000
}
```

## Regles de base Sprint 1
1. Un noeud envoie periodiquement `HELLO` en multicast UDP.
2. Les pairs mettent a jour la peer table (`node_id`, `ip`, `tcp_port`, `last_seen`).
3. Les connexions TCP actives envoient `PING` toutes les 15 secondes.
4. A reception de `PING`, repondre `PONG`.
5. Un pair est supprime de la table s'il est stale (timeout configurable).
6. Le `VALUE` TLV doit etre un objet JSON valide.

## Exemple d'encodage
Pseudo-structure d'un message `PING`:

```text
TYPE   = 0x10
LENGTH = 0x00000012
VALUE  = {"ts":1700000000}
```

## Fichier de reference code
Implementation actuelle:
- `src/archipel/protocol.js`
