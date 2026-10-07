/**
 * Burn-after-reading links.
 *
 * Creating: the note is IBE-encrypted to the identity "share id" under the
 * canister's share public key. A fresh 32-byte secret seeds an Ed25519 key;
 * the canister stores its public half. The link is
 * `/s/<share id>#<secret>`: browsers never send the fragment to a server.
 *
 * Opening: the reader signs (domain, share id, a fresh transport key) with the
 * key from the link. The canister checks the signature, spends a view and
 * returns the ciphertext with the share's vetKey encrypted to the transport
 * key. After the last view the canister deletes the ciphertext, and no one,
 * not even someone holding the link and an old copy of the ciphertext, can
 * have the key derived again.
 */
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import {
  DerivedPublicKey,
  EncryptedVetKey,
  IbeCiphertext,
  IbeIdentity,
  IbeSeed,
  TransportSecretKey,
} from "@icp-sdk/vetkeys"
import {
  concatBytes,
  decoder,
  encoder,
  fromBase64Url,
  idBytes,
  newId,
  randomBytes,
  toBase64Url,
  toBytes,
  type Bytes,
} from "./bytes"
import { checkedPublicKey } from "./keys"
import { normalizeTags, type NoteContent } from "./note"

export const SHARE_OPEN_DOMAIN = "b3note-open-share-v1"

/** What a shared note contains once decrypted. */
export interface SharePayload {
  title: string
  body: string
  tags: string[]
  /** Milliseconds since the epoch. */
  sharedAt: number
}

export interface PreparedShare {
  id: string
  secret: Bytes
  ciphertext: Bytes
  verifyingKey: Bytes
}

export function prepareShare(
  note: NoteContent,
  sharePublicKey: Uint8Array | number[],
  now = Date.now(),
): PreparedShare {
  const { id, bytes } = newId()
  const secret = randomBytes(32)
  const signer = Ed25519KeyIdentity.generate(secret)
  const payload: SharePayload = {
    title: note.title,
    body: note.body,
    tags: note.tags,
    sharedAt: now,
  }
  const ciphertext = IbeCiphertext.encrypt(
    DerivedPublicKey.deserialize(toBytes(sharePublicKey)),
    IbeIdentity.fromBytes(bytes),
    encoder.encode(JSON.stringify({ v: 1, ...payload })),
    IbeSeed.random(),
  ).serialize()
  return {
    id,
    secret,
    ciphertext: toBytes(ciphertext),
    verifyingKey: toBytes(signer.getPublicKey().toRaw()),
  }
}

export function shareLink(origin: string, id: string, secret: Uint8Array): string {
  return `${origin}/s/${id}#${toBase64Url(secret)}`
}

/** Reads the secret from a link fragment (`#...`). */
export function parseShareSecret(hash: string): Bytes | null {
  try {
    const secret = fromBase64Url(hash.replace(/^#/, ""))
    return secret.length === 32 ? secret : null
  } catch {
    return null
  }
}

export interface OpenShareRequest {
  transportKey: TransportSecretKey
  args: {
    id: string
    transport_public_key: Bytes
    signature: Bytes
  }
}

export async function openShareRequest(id: string, secret: Uint8Array): Promise<OpenShareRequest> {
  const transportKey = TransportSecretKey.random()
  const transportPublicKey = toBytes(transportKey.publicKeyBytes())
  const signer = Ed25519KeyIdentity.generate(secret)
  const signature = await signer.sign(
    concatBytes(encoder.encode(SHARE_OPEN_DOMAIN), idBytes(id), transportPublicKey),
  )
  return {
    transportKey,
    args: { id, transport_public_key: transportPublicKey, signature: toBytes(signature) },
  }
}

export interface OpenedShareReply {
  ciphertext: Uint8Array | number[]
  encrypted_key: Uint8Array | number[]
  verification_key: Uint8Array | number[]
}

export function decryptOpenedShare(
  id: string,
  transportKey: TransportSecretKey,
  opened: OpenedShareReply,
  expectedKey: DerivedPublicKey | null = null,
): SharePayload {
  const publicKey = checkedPublicKey(toBytes(opened.verification_key), expectedKey)
  const vetKey = EncryptedVetKey.deserialize(toBytes(opened.encrypted_key)).decryptAndVerify(
    transportKey,
    publicKey,
    idBytes(id),
  )
  const plaintext = IbeCiphertext.deserialize(toBytes(opened.ciphertext)).decrypt(vetKey)
  const value = JSON.parse(decoder.decode(plaintext)) as Record<string, unknown>
  return {
    title: typeof value.title === "string" ? value.title : "",
    body: typeof value.body === "string" ? value.body : "",
    tags: Array.isArray(value.tags)
      ? normalizeTags(value.tags.filter((t): t is string => typeof t === "string"))
      : [],
    sharedAt: typeof value.sharedAt === "number" ? value.sharedAt : 0,
  }
}
