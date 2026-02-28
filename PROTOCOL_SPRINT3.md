# Protocole Sprint 3 (Archipel H24)

## Objectif
Implementer le transfert de fichiers par chunks entre plusieurs noeuds avec verification d'integrite et reprise en cas d'echec.

## 1) MANIFEST
Message publie avant transfert:
- `type`: `MANIFEST`
- `file_id`: identifiant unique du fichier
- `filename`
- `file_size`
- `chunk_size`
- `nb_chunks`
- `chunks[]`: `{ index, size, hash }` (hash SHA-256)
- `sender_id`
- `ts`
- `signature`

La signature du manifeste est un HMAC-SHA256 calcule sur le manifeste sans le champ `signature`.

## 2) CHUNK_REQ / CHUNK_DATA
`CHUNK_REQ`:
- `file_id`
- `chunk_idx`
- `requester`

`CHUNK_DATA`:
- `file_id`
- `chunk_idx`
- `requester`
- `hash`
- `data_b64`
- `from`
- `signature`

La signature d'un chunk est un HMAC-SHA256 sur les metadonnees + `data_b64`.

## 3) Regles de verification reception
Pour chaque chunk recu:
1. verifier la signature du pair emetteur;
2. decoder `data_b64`;
3. recalculer SHA-256 du contenu;
4. comparer au hash attendu du manifeste;
5. si valide, stocker le chunk localement;
6. si invalide/corrompu, redemander le meme `chunk_idx` a un autre pair.

## 4) Strategie de telechargement
- Multi-sources paralleles (`maxParallel` configurable).
- Politique `rarest-first`: on demande en priorite les chunks avec moins de sources disponibles.
- Reprise automatique si un pair devient indisponible pendant le transfert.

## 5) Stockage et index local
- Stockage en memoire des chunks recus.
- Export d'un index JSON local:
  - `file_id`
  - `manifest`
  - `present[]` (liste des chunk indexes disponibles)

## 6) Tests Sprint 3
Script: `scripts/test_sprint3.js`

Cas verifies:
- transfert et reconstruction d'un fichier de 50 Mo;
- transfert continue si un pair se deconnecte en cours;
- chunk corrompu detecte puis recupere depuis une autre source.
