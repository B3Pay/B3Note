import { Principal } from "@dfinity/principal"
import { setBackend } from "contexts/helpers"
import { BACKEND_CANISTER_ID } from "helper/config"
import { useEffect, useState } from "react"
import { Backend } from "service/backend"

const useCanister = () => {
  const [backendCanister, setCanister] = useState<Backend>()

  useEffect(() => {
    setBackend()
  }, [])

  const principal = Principal.anonymous()

  const backendCanisterPrincipal = Principal.fromText(BACKEND_CANISTER_ID)

  return {
    principal,
    backendCanister,
    backendCanisterPrincipal,
  }
}

export default useCanister
