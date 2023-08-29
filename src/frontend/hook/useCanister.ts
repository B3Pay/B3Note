import { Principal } from "@dfinity/principal"
import { BACKEND_CANISTER_ID } from "frontend/helper/config"
import { Backend } from "frontend/service/backend"
import { useEffect, useState } from "react"
import { createBackendActor } from "../service/backend"

const useCanister = () => {
  const [backendCanister, setCanister] = useState<Backend>()

  useEffect(() => {
    const actor = createBackendActor()
    setCanister(actor)
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
