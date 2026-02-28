# Archipel H24

Reseau pair-a-pair multi-noeuds pour discovery local, securisation E2E, et transfert de fichiers par chunks verifiables.

## Stack
- Runtime: Node.js (modules natifs)
- Reseau: UDP multicast + TCP
- Crypto: ECDH, HKDF-SHA256, AES-256-GCM, HMAC-SHA256

## Fonctionnalites par sprint

### Sprint 1
- Discovery UDP multicast (`HELLO`) sur `239.255.42.99:6000`
- Table de pairs (`node_id`, `ip`, `tcp_port`, `last_seen`, `reputation`)
- Connexions TCP entre noeuds
- Keepalive `PING/PONG`

### Sprint 2
- Handshake securise (`HELLO`, `HELLO_REPLY`, `FINISHED`)
- Derivation de cle de session via ECDH + HKDF
- Chiffrement applicatif AES-256-GCM
- Signature HMAC-SHA256 des paquets
- Protection anti-rejeu (timestamp + nonce)
- Web of trust minimal (`trusted` / `revoked`)

### Sprint 3
- Generation de `MANIFEST` signe (hash par chunk)
- Telechargement multi-sources en parallele
- Strategie `rarest-first`
- Verification signature + hash SHA-256 de chaque chunk
- Retry automatique si pair indisponible
- Rejet et recuperation des chunks corrompus

## Structure du repo
```text
archipel-h24/
  PROTOCOL_SPRINT1.md
  PROTOCOL_SPRINT2.md
  PROTOCOL_SPRINT3.md
  README.md
  run_node.js
  package.json
  scripts/
    demo_sprint1.ps1
    generate_keys.ps1
    test_sprint1_ports.ps1
    test_sprint2.js
    test_sprint3.js
  src/archipel/
    node.js
    discovery.js
    peer_table.js
    protocol.js
    tcp_server.js
    crypto_utils.js
    handshake.js
    secure_message.js
    trust_store.js
    manifest.js
    chunk_store.js
    chunk_transfer.js
```

## Prerequis
- Windows + PowerShell
- Node.js 18+

Verifier:
```powershell
node -v
npm -v
```

## Installation
```powershell
cd "C:\Users\sigar\Desktop\archipel-h24\archipel-h24\archipel-h24"
npm install
```

## Execution
Lancer un noeud:
```powershell
node run_node.js --tcp-port 7777 --hello-interval 30 --stale-timeout 90
```

Demo Sprint 1 (3 noeuds):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\demo_sprint1.ps1
```

## Tests
Test Sprint 1 (connectivite ports):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test_sprint1_ports.ps1
```

Test Sprint 2 (crypto + trust):
```powershell
npm.cmd run test:sprint2
```

Test Sprint 3 (chunking + transfert):
```powershell
npm.cmd run test:sprint3
```

## Protocoles
- [PROTOCOL_SPRINT1.md](./PROTOCOL_SPRINT1.md)
- [PROTOCOL_SPRINT2.md](./PROTOCOL_SPRINT2.md)
- [PROTOCOL_SPRINT3.md](./PROTOCOL_SPRINT3.md)

## Soumission Sprint 4
Checklist finale:
- [x] README complet (install, run, tests)
- [x] Protocoles Sprint 1/2/3 documentes
- [x] Tests Sprint 2 et Sprint 3 passants
- [x] Historique Git propre sur branche `feat/run`

## Securite
- Ne pas versionner de secrets (`.env`, cles privees reelles)
- Les fichiers sensibles doivent rester hors Git
- Verification integrite obligatoire avant reconstruction de fichier

## Auteurs
- Equipe Cloud Warriors
