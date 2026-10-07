/**
 * A stand-in for the vetKD system API with a known master secret, for tests.
 *
 * It produces genuine vetKeys (BLS signatures on the input) and encrypts them
 * to a transport public key exactly like the IC does, so the app's real
 * decryption and verification code runs against it.
 */
import { DerivedPublicKey, augmentedHashToG1 } from "@icp-sdk/vetkeys"
import { bls12_381 } from "@noble/curves/bls12-381"

const { G1, G2 } = bls12_381
const ORDER = bls12_381.fields.Fr.ORDER

function randomScalar(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(48))
  const value = BigInt(`0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`) % ORDER
  return value === 0n ? 1n : value
}

export class FakeVetKd {
  readonly #secret = randomScalar()
  readonly publicKey = new DerivedPublicKey(G2.Point.BASE.multiply(this.#secret))

  publicKeyBytes(): Uint8Array {
    return this.publicKey.publicKeyBytes()
  }

  /** The EncryptedVetKey (c1 ‖ c2 ‖ c3) for `input`, encrypted to `transportPublicKey`. */
  deriveEncryptedKey(input: Uint8Array, transportPublicKey: Uint8Array): Uint8Array {
    const vetKey = augmentedHashToG1(this.publicKey, input).multiply(this.#secret)
    const transport = G1.Point.fromBytes(transportPublicKey)
    const r = randomScalar()
    const c1 = G1.Point.BASE.multiply(r)
    const c2 = G2.Point.BASE.multiply(r)
    const c3 = vetKey.add(transport.multiply(r))
    return new Uint8Array([...c1.toBytes(true), ...c2.toBytes(true), ...c3.toBytes(true)])
  }
}
