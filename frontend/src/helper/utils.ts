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

export function extractLoadingTitle(loadings: LoadingKey): string | null {
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

  if (match) {
    return match[1].trim() + "!"
  }

  if (errorString.length < 100) {
    return errorString
  }

  return "Unknown error!"
}

export function nanoToHumanReadable(nanoTimestamp: bigint | null) {
  if (nanoTimestamp === null) return null

  // Convert to milliseconds
  const milliTimestamp = nanoTimestamp / BigInt(1_000_000)

  // Convert BigInt to Number
  const milliTimestampNumber = Number(milliTimestamp)

  // Create a new Date object
  const date = new Date(milliTimestampNumber)

  // Format the date and time
  return date.toLocaleString()
}

export function nanoToHumanReadableElapsed(nanoTimestamp: bigint | null) {
  if (nanoTimestamp === null) return null

  // Convert to milliseconds
  const milliTimestamp = nanoTimestamp / BigInt(1_000_000)

  // Convert BigInt to Number
  const milliTimestampNumber = Number(milliTimestamp)

  // Create a new Date object
  const date = new Date(milliTimestampNumber)

  const now = new Date()

  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)

  const minutes = Math.floor(seconds / 60)

  const hours = Math.floor(minutes / 60)

  return `${hours} hours, ${minutes % 60} minutes, ${seconds % 60} seconds`
}

export function formatCyclesToMCycles(cycles?: bigint) {
  if (!cycles) return "0"
  const mcycles = cycles / BigInt(1_000_000)
  return mcycles.toString()
}
