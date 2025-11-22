import { JmapResponse } from "./types"
import { StatusCodes } from "http-status-codes"
import { RequestError, requestErrors } from "../errors"
import { JmapRequest } from "./types"
import { capabilities } from "../session/types"
import { processRequest } from "./request"
import { z } from "zod"

export function postApi(
  headers: Record<string, string>,
  body: string
): JmapResponse | RequestError {
  const contentTypeHeader =
    headers["content-type"] ?? headers["Content-Type"] ?? headers["CONTENT-TYPE"]

  if (!contentTypeHeader || !contentTypeHeader.toLowerCase().startsWith("application/json")) {
    const requestError: RequestError = {
      type: requestErrors.notJson,
      status: StatusCodes.BAD_REQUEST,
      detail: "Content type of the request was not application/json",
    }
    return requestError
  }

  let jmapRequest: JmapRequest
  try {
    //TODO ensure IJSON
    jmapRequest = JSON.parse(body)
  } catch {
    const requestError: RequestError = {
      type: requestErrors.notJson,
      status: StatusCodes.BAD_REQUEST,
      detail: "Request did not parse as I-JSON",
    }
    return requestError
  }

  const requestAsSchema = requestSchema.safeParse(jmapRequest)

  if (!requestAsSchema.success) {
    const requestError: RequestError = {
      type: requestErrors.notRequest,
      status: StatusCodes.BAD_REQUEST,
      detail: "Request did not match the type signature of the Request object",
    }
    return requestError
  }

  // Check client is not using unknown capabilities
  for (const capability of requestAsSchema.data.using) {
    // check capability is in capabilities object
    if (!(Object.values(capabilities) as string[]).includes(capability)) {
      const requestError: RequestError = {
        type: requestErrors.unknownCapability,
        status: StatusCodes.BAD_REQUEST,
        detail: `Unknown capability: ${capability}`,
      }
      return requestError
    }
  }

  // TODO validate limits
  // Process the request
  const response = processRequest(requestAsSchema.data as JmapRequest)
  return response
}

const requestSchema = z.object({
  using: z.array(z.string()),
  methodCalls: z.array(z.tuple([z.string(), z.record(z.string(), z.unknown()), z.string()])).min(1),
  createdIds: z.record(z.string(), z.string()).optional(),
})
