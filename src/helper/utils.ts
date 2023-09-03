export const hex_decode = (hexString: string) =>
  Uint8Array.from(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))

export const hex_encode = (bytes: Uint8Array | number[]) =>
  (bytes as Uint8Array).reduce(
    (str, byte) => str + byte.toString(16).padStart(2, "0"),
    ""
  )

export type LoadingKey =
  | {
      [x: string]: {
        [x: string]: boolean
      }
    }
  | { [x: string]: boolean }

export function findLatestTrueKey(loadings: LoadingKey) {
  let latestTrueKey: string | null = null

  for (const [key, value] of Object.entries(loadings)) {
    if (typeof value === "object") {
      const innerKey = findLatestTrueKey(value)
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
