/** Byte helpers shared by the crypto code. */

export type Bytes = Uint8Array<ArrayBuffer>

/** Candid blobs arrive as `Uint8Array` but are typed `Uint8Array | number[]`. */
export function toBytes(value: Uint8Array | number[]): Bytes {
  return value instanceof Uint8Array ? new Uint8Array(value) : Uint8Array.from(value)
}

export function concatBytes(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function fromHex(hex: string): Bytes {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Invalid hex string")
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function fromBase64Url(text: string): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("Invalid base64url string")
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** Note and share ids: 16 random bytes as 32 lowercase hex characters. */
export function newId(): { id: string; bytes: Bytes } {
  const bytes = randomBytes(16)
  return { id: toHex(bytes), bytes }
}

export function idBytes(id: string): Bytes {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error(`Invalid id: ${id}`)
  return fromHex(id)
}

export const encoder = new TextEncoder()
export const decoder = new TextDecoder()
