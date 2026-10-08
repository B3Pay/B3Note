/**
 * Offline derivation of the canister's vetKD public keys.
 *
 * On mainnet the master public keys are well known, so the app derives the
 * key it expects for this canister and context itself and refuses one that a
 * (compromised or impersonated) canister reports differently.
 */
import type { Principal } from "@icp-sdk/core/principal"
import { DerivedPublicKey, MasterPublicKey, MasterPublicKeyId } from "@icp-sdk/vetkeys"
import { encoder } from "./bytes"

export const USER_KEY_CONTEXT = "b3note/user-key/v1"
export const SHARE_KEY_CONTEXT = "b3note/share/v1"

const PRODUCTION_KEYS: Record<string, MasterPublicKeyId> = {
  key_1: MasterPublicKeyId.KEY_1,
  test_key_1: MasterPublicKeyId.TEST_KEY_1,
}

/**
 * The derived public key a mainnet canister must report, or `null` when it
 * cannot be computed offline (local networks, unknown key names).
 */
export function expectedPublicKey(
  keyName: string,
  canisterId: Principal,
  context: string,
  isLocal: boolean,
): DerivedPublicKey | null {
  const keyId = PRODUCTION_KEYS[keyName]
  if (isLocal || !keyId) return null
  return MasterPublicKey.productionKey(keyId)
    .deriveCanisterKey(canisterId.toUint8Array())
    .deriveSubKey(encoder.encode(context))
}

export function samePublicKey(a: DerivedPublicKey, b: DerivedPublicKey): boolean {
  const x = a.publicKeyBytes()
  const y = b.publicKeyBytes()
  return x.length === y.length && x.every((byte, i) => byte === y[i])
}

/** Parses the key the canister reports and checks it against `expected`. */
export function checkedPublicKey(reported: Uint8Array, expected: DerivedPublicKey | null): DerivedPublicKey {
  const key = DerivedPublicKey.deserialize(reported)
  if (expected && !samePublicKey(key, expected)) {
    throw new Error(
      "The canister reported a vetKD public key that does not match the Internet Computer's master key. Refusing to use it.",
    )
  }
  return key
}
