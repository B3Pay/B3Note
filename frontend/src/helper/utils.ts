import { bigintToBuf } from "bigint-conversion"

export const hex_decode = (hexString: string) =>
  Uint8Array.from(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))

export const hex_encode = (bytes: Uint8Array | number[]) =>
  (bytes as Uint8Array).reduce(
    (str, byte) => str + byte.toString(16).padStart(2, "0"),
    ""
  )

export const stringToBigIntAndUint8Array = (str: string) => {
  const id = BigInt(str)

  const input = new Uint8Array(8)

  let inputId = new Uint8Array(bigintToBuf(id))

  input.set(inputId)

  return { input, id }
}

export type NonNullableProperties<T> = {
  [K in keyof T]: NonNullable<T[K]>
}

export type LoadingKey =
  | {
      [x: string]: {
        [x: string]: boolean
      }
    }
  | { [x: string]: boolean }

export function extractLoadingTitle(loadings: LoadingKey) {
  let latestTrueKey: string | null = null

  for (const [key, value] of Object.entries(loadings)) {
    if (typeof value === "object") {
      const innerKey = extractLoadingTitle(value)
      if (innerKey !== null) {
        latestTrueKey = innerKey
      }
    } else if (value === true) {
      latestTrueKey = key
    }
  }

  return toReadableString(latestTrueKey)
}

export function toReadableString(str: string | null) {
  if (!str) return null

  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function generateLink(id: string, signature: Uint8Array) {
  return `${
    window.location.origin
  }/withoutii?id=${id.toString()}&signature=${hex_encode(signature)}`
}

export const compileError = (error: any) => {
  const errorString = error.toString()

  const regex = /Error::(.*?)!/
  const match = errorString.match(regex)

  return match ? match[1].trim() + "!" : "Unknown error!"
}

export function nanoToHumanReadable(nanoTimestamp: bigint) {
  // Convert to milliseconds
  const milliTimestamp = nanoTimestamp / BigInt(1_000_000)

  // Convert BigInt to Number
  const milliTimestampNumber = Number(milliTimestamp)

  // Create a new Date object
  const date = new Date(milliTimestampNumber)

  // Format the date and time
  return date.toLocaleString()
}
