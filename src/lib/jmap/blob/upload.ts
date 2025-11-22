import { Id, UnsignedInt } from "../types"
import { UploadResponse } from "./types"
import { newBlobId } from "../id"
import { ProblemDetails } from "../../errors"

export async function upload(
  accountId: Id,
  contentType: string,
  data: Buffer
): Promise<UploadResponse | ProblemDetails> {
  const blobId = newBlobId(data)

  // TODO upload blob to storage
  // Return a ProblemDetails error if the upload fails

  const blobResponse: UploadResponse = {
    accountId: accountId,
    blobId: blobId,
    type: contentType,
    size: data.length as UnsignedInt,
  }

  return blobResponse
}
