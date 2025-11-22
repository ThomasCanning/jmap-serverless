import { Id } from "../types"
import { ProblemDetails } from "../../errors"

export async function download(_accountId: Id, _blobId: Id): Promise<Buffer | ProblemDetails> {
  // TODO download blob from storage
  // Return a ProblemDetails error if the download fails

  // Mock data for now
  return Buffer.from("blob data", "utf-8")
}
