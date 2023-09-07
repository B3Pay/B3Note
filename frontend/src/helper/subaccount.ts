import { Principal } from "@dfinity/principal"

export function generateSubaccount(principal: Principal) {
  // Assuming principal is a Uint8Array or similar array-like object
  let principalId = principal

  // Get the size of Subaccount; assuming it's a fixed size,
  // say 32 bytes (you'll need to adjust this)
  const subaccountSize = 32

  // Create an empty array with a size of Subaccount
  let subaccount = new Uint8Array(subaccountSize)

  let principalUint = principalId.toUint8Array()

  // Set the first element to the length of principalId
  subaccount[0] = principalUint.length

  // Copy the remaining elements from principalId
  subaccount.set(principalUint, 1)

  return subaccount
}
