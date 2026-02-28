# Protocole Sprint 2 (Archipel H24)

## Objectif
Ajouter la securite E2E pour les messages entre noeuds:
- echange de cle de session avec ECDH;
- chiffrement des messages avec AES-256-GCM;
- integrite/authentification avec HMAC-SHA256;
- mecanisme local de confiance/revocation (web of trust minimal).

## 1. Handshake

### 1.1 Messages
- `HELLO`: `node_id`, `timestamp`, `ecdh_pub`, `curve`
- `HELLO_REPLY`: `node_id`, `peer_node_id`, `timestamp`, `ecdh_pub`, `sig`
- `FINISHED`: `node_id`, `peer_node_id`, `timestamp`, `ok`, `sig`

### 1.2 Sequence
1. Initiateur envoie `HELLO` avec sa cle publique ECDH ephemere.
2. Recepteur genere sa cle ephemere, derive la cle de session, puis renvoie `HELLO_REPLY` signe HMAC.
3. Initiateur derive la meme cle de session, verifie la signature, puis envoie `FINISHED` signe.
4. Recepteur valide `FINISHED`.

## 2. Derivation de cle
- Secret partage via ECDH (`prime256v1`).
- Cle de session derivee via HKDF-SHA256 (32 octets).

## 3. Chiffrement des messages
Format logique d'un message securise:
- metadonnees en clair: `from`, `to`, `type`, `ts`, `nonce`
- contenu chiffre: `ct` (ciphertext)
- parametres cryptos: `iv`, `tag` (AES-GCM)
- signature: `sig` (HMAC-SHA256)

Validation a la reception:
1. verifier `ts` (fenetre de skew max);
2. verifier `nonce` non deja vu (anti-rejeu);
3. verifier `sig`;
4. dechiffrer AES-GCM;
5. parser le payload JSON.

## 4. Web of trust minimal
Fichier local: `trust_store.json`

Structure:
```json
{
  "version": 1,
  "peers": {
    "node-b": {
      "node_id": "node-b",
      "public_key": "...",
      "status": "trusted",
      "updated_at": 1700000000
    }
  }
}
```

Statuts:
- `trusted`: pair autorise
- `revoked`: pair refuse

## 5. Tests Sprint 2
Script: `scripts/test_sprint2.js`

Couvre:
- handshake reussi et cle de session identique des 2 cotes;
- chiffrement/dechiffrement OK + blocage du rejeu;
- rejet d'une signature invalide;
- revocation dans `trust_store`.
