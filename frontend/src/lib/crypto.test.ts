import { Principal } from "@icp-sdk/core/principal"
import { describe, expect, it } from "vitest"
import { FakeVetKd } from "../../tests/support/fakeVetKd"
import { newId, toBytes } from "./bytes"
import {
  checkedPublicKey,
  expectedPublicKey,
  samePublicKey,
  SHARE_KEY_CONTEXT,
  USER_KEY_CONTEXT,
} from "./keys"
import {
  decryptOpenedShare,
  openShareRequest,
  parseShareSecret,
  prepareShare,
  shareLink,
  SHARE_OPEN_DOMAIN,
} from "./share"
import { unlockVault, vaultCacheKey, type KeyCache } from "./vault"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import { concatBytes, encoder, idBytes } from "./bytes"

const alice = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai")
const canister = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai")
const note = { title: "Trip", body: "- [ ] passport\n- [x] tickets", tags: ["travel"], pinned: true }

function memoryCache(): KeyCache & { store: Map<string, CryptoKey> } {
  const store = new Map<string, CryptoKey>()
  return {
    store,
    get: async (key) => store.get(key),
    set: async (key, value) => void store.set(key, value),
    del: async (key) => void store.delete(key),
  }
}

describe("vault", () => {
  it("unlocks with a verified vetKey and round-trips notes", async () => {
    const vetKd = new FakeVetKd()
    const requests: Uint8Array[] = []
    const vault = await unlockVault({
      principal: alice,
      canisterId: canister,
      fetchEncryptedKey: async (tpk) => {
        requests.push(tpk)
        return {
          encrypted_key: vetKd.deriveEncryptedKey(alice.toUint8Array(), tpk),
          verification_key: vetKd.publicKeyBytes(),
        }
      },
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toHaveLength(48)

    const { id } = newId()
    const ciphertext = await vault.encrypt(id, note)
    expect(new TextDecoder().decode(ciphertext)).not.toContain("passport")
    await expect(vault.decrypt(id, 1n, ciphertext)).resolves.toEqual(note)
    // Bound to its id: the same ciphertext under another id does not decrypt.
    await expect(vault.decrypt(newId().id, 1n, ciphertext)).rejects.toThrow()
  })

  it("derives the same key in every session, so old notes stay readable", async () => {
    const vetKd = new FakeVetKd()
    const unlock = () =>
      unlockVault({
        principal: alice,
        canisterId: canister,
        fetchEncryptedKey: async (tpk) => ({
          encrypted_key: vetKd.deriveEncryptedKey(alice.toUint8Array(), tpk),
          verification_key: vetKd.publicKeyBytes(),
        }),
      })
    const { id } = newId()
    const ciphertext = await (await unlock()).encrypt(id, note)
    await expect((await unlock()).decrypt(id, 1n, ciphertext)).resolves.toEqual(note)
  })

  it("refuses a vetKey for another principal", async () => {
    const vetKd = new FakeVetKd()
    const mallory = Principal.fromText("aaaaa-aa")
    await expect(
      unlockVault({
        principal: alice,
        canisterId: canister,
        fetchEncryptedKey: async (tpk) => ({
          encrypted_key: vetKd.deriveEncryptedKey(mallory.toUint8Array(), tpk),
          verification_key: vetKd.publicKeyBytes(),
        }),
      }),
    ).rejects.toThrow()
  })

  it("refuses a public key that is not the expected one", async () => {
    const real = new FakeVetKd()
    const impostor = new FakeVetKd()
    await expect(
      unlockVault({
        principal: alice,
        canisterId: canister,
        expectedKey: real.publicKey,
        fetchEncryptedKey: async (tpk) => ({
          encrypted_key: impostor.deriveEncryptedKey(alice.toUint8Array(), tpk),
          verification_key: impostor.publicKeyBytes(),
        }),
      }),
    ).rejects.toThrow(/does not match/)
  })

  it("caches the key material so a reload needs no derivation", async () => {
    const vetKd = new FakeVetKd()
    const cache = memoryCache()
    let derivations = 0
    const options = {
      principal: alice,
      canisterId: canister,
      cache,
      fetchEncryptedKey: async (tpk: Uint8Array) => {
        derivations += 1
        return {
          encrypted_key: vetKd.deriveEncryptedKey(alice.toUint8Array(), tpk),
          verification_key: vetKd.publicKeyBytes(),
        }
      },
    }
    const first = await unlockVault(options)
    const second = await unlockVault(options)
    expect(derivations).toBe(1)
    expect(cache.store.has(vaultCacheKey(canister.toText(), alice.toText()))).toBe(true)
    const { id } = newId()
    await expect(second.decrypt(id, 1n, await first.encrypt(id, note))).resolves.toEqual(note)
  })
})

describe("share links", () => {
  it("encrypts to the share id and decrypts with that share's vetKey", async () => {
    const vetKd = new FakeVetKd()
    const prepared = prepareShare(note, vetKd.publicKeyBytes(), 1_700_000_000_000)
    expect(prepared.verifyingKey).toHaveLength(32)
    expect(prepared.secret).toHaveLength(32)

    const link = shareLink("https://b3note.app", prepared.id, prepared.secret)
    const url = new URL(link)
    expect(url.pathname).toBe(`/s/${prepared.id}`)
    const secret = parseShareSecret(url.hash)!
    expect(secret).toEqual(prepared.secret)

    const request = await openShareRequest(prepared.id, secret)
    // What the canister checks: the link key signed the id and transport key.
    const message = concatBytes(
      encoder.encode(SHARE_OPEN_DOMAIN),
      idBytes(prepared.id),
      request.args.transport_public_key,
    )
    const signer = Ed25519KeyIdentity.generate(secret)
    expect(toBytes(signer.getPublicKey().toRaw())).toEqual(prepared.verifyingKey)
    expect(request.args.signature).toHaveLength(64)
    expect(message.length).toBe(SHARE_OPEN_DOMAIN.length + 16 + 48)

    const payload = decryptOpenedShare(prepared.id, request.transportKey, {
      ciphertext: prepared.ciphertext,
      encrypted_key: vetKd.deriveEncryptedKey(idBytes(prepared.id), request.args.transport_public_key),
      verification_key: vetKd.publicKeyBytes(),
    })
    expect(payload).toEqual({ title: "Trip", body: note.body, tags: ["travel"], sharedAt: 1_700_000_000_000 })
  })

  it("a vetKey for another share id does not open it", async () => {
    const vetKd = new FakeVetKd()
    const prepared = prepareShare(note, vetKd.publicKeyBytes())
    const request = await openShareRequest(prepared.id, prepared.secret)
    expect(() =>
      decryptOpenedShare(prepared.id, request.transportKey, {
        ciphertext: prepared.ciphertext,
        encrypted_key: vetKd.deriveEncryptedKey(idBytes(newId().id), request.args.transport_public_key),
        verification_key: vetKd.publicKeyBytes(),
      }),
    ).toThrow()
  })

  it("rejects malformed link secrets", () => {
    expect(parseShareSecret("")).toBeNull()
    expect(parseShareSecret("#not base64!")).toBeNull()
    expect(parseShareSecret("#AAAA")).toBeNull()
  })
})

describe("mainnet key pinning", () => {
  it("derives the expected keys offline and only on mainnet", () => {
    const user = expectedPublicKey("key_1", canister, USER_KEY_CONTEXT, false)!
    const share = expectedPublicKey("key_1", canister, SHARE_KEY_CONTEXT, false)!
    expect(user.publicKeyBytes()).toHaveLength(96)
    expect(samePublicKey(user, share)).toBe(false)
    expect(samePublicKey(user, expectedPublicKey("key_1", canister, USER_KEY_CONTEXT, false)!)).toBe(true)
    expect(expectedPublicKey("key_1", canister, USER_KEY_CONTEXT, true)).toBeNull()
    expect(expectedPublicKey("dfx_test_key", canister, USER_KEY_CONTEXT, false)).toBeNull()
    expect(() => checkedPublicKey(share.publicKeyBytes(), user)).toThrow(/does not match/)
    expect(samePublicKey(checkedPublicKey(user.publicKeyBytes(), user), user)).toBe(true)
  })
})
