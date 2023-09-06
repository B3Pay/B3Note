export const hex_decode = (hexString: string) =>
  Uint8Array.from(hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))

export const hex_encode = (bytes: Uint8Array | number[]) =>
  (bytes as Uint8Array).reduce(
    (str, byte) => str + byte.toString(16).padStart(2, "0"),
    ""
  )

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

export function generateLink(id: Uint8Array | number[], signature: Uint8Array) {
  return `${window.location.origin}/withoutii?id=${hex_encode(
    id
  )}&signature=${hex_encode(signature)}`
}

export const compileError = (error: any) => {
  const errorString = error.toString()
  const regex = /Error::(.*?)'/
  const match = errorString.match(regex)
  return match ? match[1].trim() : "Unknown error"
}
