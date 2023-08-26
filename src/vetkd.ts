import { Actor } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import * as vetkd from "vetkd-utils"
import { authenticator } from "../../declarations/authenticator"

let fetched_symmetric_key = null

let app_backend_principal = Principal.fromText(
  process.env.APP_BACKEND_CANISTER_ID
)

let auth_canister_actor = authenticator
let auth_canister_principal = await Actor.agentOf(
  auth_canister_actor
).getPrincipal()
document.getElementById("principal").innerHTML = annotated_principal(
  auth_canister_principal
)

document.getElementById("2fa_login").addEventListener("submit", async (e) => {
  e.preventDefault()
  const button = e.target.querySelector("button")
  button.setAttribute("disabled", true)
  const result = document.getElementById("2fa_login_result")

  result.innerText = "Fetching symmetric key..."
  const seed = window.crypto.getRandomValues(new Uint8Array(32))
  const tsk = new vetkd.TransportSecretKey(seed)

  console.log({ public_key: hex_encode(tsk.public_key_g2()) })
  console.log({
    signature: hex_encode(tsk.vrf_proof(hex_decode("0123456789"))),
  })

  const ek_bytes_hex =
    await auth_canister_actor.encrypted_symmetric_key_for_caller(
      tsk.public_key()
    )

  const signed_msg = tsk.vrf_proof(
    hex_decode(document.getElementById("2fa_login_code").value)
  )

  const pk_bytes_hex =
    await auth_canister_actor.symmetric_key_verification_key()

  console.log(hex_encode(tsk.public_key_g2()))
  result.innerText = hex_encode(signed_msg)

  button.removeAttribute("disabled")

  fetched_symmetric_key = tsk.decrypt_and_hash(
    hex_decode(ek_bytes_hex),
    hex_decode(pk_bytes_hex),
    auth_canister_principal.toUint8Array(),
    32,
    new TextEncoder().encode("aes-256-gcm")
  )

  return false
})

function annotated_principal(principal) {
  let principal_string = principal.toString()
  if (principal_string == "2vxsx-fae") {
    return "Anonymous principal (2vxsx-fae)"
  } else {
    return "Principal: " + principal_string
  }
}

document
  .getElementById("ibe_plaintext")
  .addEventListener("keyup", async (e) => {
    update_ibe_encrypt_button_state()
  })

document
  .getElementById("ibe_principal")
  .addEventListener("keyup", async (e) => {
    update_ibe_encrypt_button_state()
  })

document
  .getElementById("ibe_ciphertext")
  .addEventListener("keyup", async (e) => {
    update_ibe_decrypt_button_state()
  })

async function time_lock_encrypt(message, lock_until_time) {
  document.getElementById("time_lock_encrypt_result").innerText =
    "Preparing Time-Lock Encryption..."

  // Store the lock_until_time with the encrypted content
  const time_based_principal = Principal.fromText(lock_until_time.toString())

  document.getElementById("time_lock_encrypt_result").innerText =
    "Fetching IBE encryption key for time " + lock_until_time + "..."
  const pk_bytes_hex = await auth_canister_actor.ibe_encryption_key()

  const message_encoded = new TextEncoder().encode(message)
  const seed = window.crypto.getRandomValues(new Uint8Array(32))

  document.getElementById("time_lock_encrypt_result").innerText =
    "Time-Lock encrypting for time " + lock_until_time + "..."
  const time_lock_ciphertext = vetkd.IBECiphertext.encrypt(
    hex_decode(pk_bytes_hex),
    time_based_principal.toUint8Array(),
    message_encoded,
    seed
  )

  // Store the lock_until_time with the encrypted content
  return {
    lock_until_time: lock_until_time,
    ciphertext: hex_encode(time_lock_ciphertext.serialize()),
  }
}
async function time_lock_decrypt(time_lock_data) {
  document.getElementById("time_lock_decrypt_result").innerText =
    "Preparing Time-Lock decryption..."

  const lock_until_time = time_lock_data.lock_until_time
  const time_lock_ciphertext_hex = time_lock_data.ciphertext

  // Check if the current time has reached the lock_until_time
  if (new Date().getTime() < lock_until_time) {
    document.getElementById("time_lock_decrypt_result").innerText =
      "Decryption time not reached. Please try again later."
    return
  }

  const tsk_seed = window.crypto.getRandomValues(new Uint8Array(32))
  const tsk = new vetkd.TransportSecretKey(tsk_seed)

  document.getElementById("time_lock_decrypt_result").innerText =
    "Fetching Time-Lock decryption key..."
  const ek_bytes_hex =
    await auth_canister_actor.encrypted_time_lock_decryption_key(
      tsk.public_key(),
      lock_until_time
    )

  document.getElementById("time_lock_decrypt_result").innerText =
    "Fetching IBE encryption key (needed for verification)..."
  const pk_bytes_hex = await auth_canister_actor.ibe_encryption_key_for_time(
    lock_until_time
  )

  const k_bytes = tsk.decrypt(
    hex_decode(ek_bytes_hex),
    hex_decode(pk_bytes_hex),
    auth_canister_principal.toUint8Array()
  )

  const time_lock_ciphertext = vetkd.IBECiphertext.deserialize(
    hex_decode(time_lock_ciphertext_hex)
  )
  const time_lock_plaintext = time_lock_ciphertext.decrypt(k_bytes)
  return new TextDecoder().decode(time_lock_plaintext)
}

const hex_decode = (hexString) =>
  Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
const hex_encode = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")
