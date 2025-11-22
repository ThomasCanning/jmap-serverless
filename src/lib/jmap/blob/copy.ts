import { Invocation } from "../types"
import { CopyRequestArgs, CopyResponseArgs } from "./types"

export function blobCopy(methodCall: Invocation): Invocation {
  const args = methodCall[1] as CopyRequestArgs
  const methodCallId = methodCall[2]

  //TODO implement blob copy
  const response: CopyResponseArgs = {
    fromAccountId: args.fromAccountId,
    accountId: args.accountId,
    copied: {},
    notCopied: {},
  }

  return ["Blob/copy", response, methodCallId]
}
