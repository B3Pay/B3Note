/**
 * The vault holds the user's note key material and encrypts and decrypts notes
 * with it.
 *
 * - Internet Identity accounts: unlocking asks the canister for the user's
 *   vetKey, encrypted to a one-time transport key generated here, then
 *   decrypts it and verifies it against the canister's public key and the
 *   user's principal. The resulting key material is a non-extractable
 *   CryptoKey, which is cached in IndexedDB so a reload does not need another
 *   vetKD derivation.
 * - Guests: the guest key already is a secret only this user holds, so the key
 *   material is derived from it here (HKDF, bound to the canister). It costs
 *   the canister nothing, and the recovery key restores it on another device.
 */
import type { Principal } from "@icp-sdk/core/principal"
import { DerivedKeyMaterial, DerivedPublicKey, EncryptedVetKey, TransportSecretKey } from "@icp-sdk/vetkeys"
import { decoder, encoder, idBytes, toBytes, type Bytes } from "./bytes"
import { checkedPublicKey } from "./keys"
import { parseNote, serializeNote, type NoteContent } from "./note"

/** AES-GCM domain separator for notes. The associated data is the note id. */
export const NOTE_DOMAIN = "b3note/note/v1"
/** HKDF salt of a guest's key material; the info is the canister id. */
export const GUEST_KEY_DOMAIN = "b3note/guest-key/v1"

export interface KeyCache {
  get(key: string): Promise<CryptoKey | undefined>
  set(key: string, value: CryptoKey): Promise<void>
  del(key: string): Promise<void>
}

export interface EncryptedUserKey {
  encrypted_key: Uint8Array | number[]
  verification_key: Uint8Array | number[]
}

export class Vault {
  readonly #keyMaterial: DerivedKeyMaterial
  readonly #plaintexts = new Map<string, NoteContent>()

  constructor(
    readonly principal: string,
    keyMaterial: DerivedKeyMaterial,
  ) {
    this.#keyMaterial = keyMaterial
  }

  async encrypt(id: string, note: NoteContent): Promise<Bytes> {
    const ciphertext = await this.#keyMaterial.encryptMessage(serializeNote(note), NOTE_DOMAIN, idBytes(id))
    return toBytes(ciphertext)
  }

  /** Decrypts one version of a note; results are memoized by id and version. */
  async decrypt(id: string, version: bigint, ciphertext: Uint8Array | number[]): Promise<NoteContent> {
    const memo = `${id}:${version}`
    const known = this.#plaintexts.get(memo)
    if (known) return known
    const plaintext = await this.#keyMaterial.decryptMessage(toBytes(ciphertext), NOTE_DOMAIN, idBytes(id))
    const note = parseNote(decoder.decode(plaintext))
    this.#plaintexts.set(memo, note)
    return note
  }
}

export function vaultCacheKey(canisterId: string, principal: string): string {
  return `b3note:vault:v1:${canisterId}:${principal}`
}

export interface UnlockOptions {
  principal: Principal
  canisterId: Principal
  /** Calls `get_encrypted_user_key` with the transport public key. */
  fetchEncryptedKey: (transportPublicKey: Bytes) => Promise<EncryptedUserKey>
  /** The derived public key computed offline, when it can be (mainnet). */
  expectedKey?: DerivedPublicKey | null
  cache?: KeyCache | null
}

export async function unlockVault({
  principal,
  canisterId,
  fetchEncryptedKey,
  expectedKey = null,
  cache = null,
}: UnlockOptions): Promise<Vault> {
  const cacheKey = vaultCacheKey(canisterId.toText(), principal.toText())
  const cached = await cache?.get(cacheKey).catch(() => undefined)
  if (cached) {
    return new Vault(principal.toText(), await DerivedKeyMaterial.fromCryptoKey(cached))
  }

  const transportKey = TransportSecretKey.random()
  const reply = await fetchEncryptedKey(toBytes(transportKey.publicKeyBytes()))
  const publicKey = checkedPublicKey(toBytes(reply.verification_key), expectedKey)
  const vetKey = EncryptedVetKey.deserialize(toBytes(reply.encrypted_key)).decryptAndVerify(
    transportKey,
    publicKey,
    principal.toUint8Array(),
  )
  const keyMaterial = await vetKey.asDerivedKeyMaterial()
  await cache?.set(cacheKey, keyMaterial.getCryptoKey()).catch(() => undefined)
  return new Vault(principal.toText(), keyMaterial)
}

/**
 * The vault of a guest, derived from their 32-byte guest key: HKDF-SHA-256
 * with `GUEST_KEY_DOMAIN` as salt and the canister id as info, so each
 * deployment gets its own key. Nothing is fetched or cached.
 */
export async function guestVault(
  principal: Principal,
  canisterId: Principal,
  seed: Uint8Array,
): Promise<Vault> {
  const subtle = globalThis.crypto.subtle
  const secret = await subtle.importKey("raw", toBytes(seed), "HKDF", false, ["deriveBits"])
  const bits = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(GUEST_KEY_DOMAIN),
      info: toBytes(canisterId.toUint8Array()),
    },
    secret,
    256,
  )
  const base = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey", "deriveBits"])
  return new Vault(principal.toText(), await DerivedKeyMaterial.fromCryptoKey(base))
}
