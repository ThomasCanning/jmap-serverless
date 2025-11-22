import { UnsignedInt } from "../types"
import { CapabilityJmapCore } from "./types"
import { Session } from "./types"
import { Id } from "../types"
import { Account } from "./types"
import { Accounts } from "./types"
import { capabilities } from "./types"
import { StatusCodes } from "http-status-codes"
import { SessionUrls } from "./types"
import { AuthResult } from "../../auth/types"
import { createProblemDetails, errorTypes, isProblemDetails, ProblemDetails } from "../../errors"

export const capabilityJmapCore: CapabilityJmapCore = {
  maxSizeUpload: 50000000 as UnsignedInt,
  maxConcurrentUpload: 4 as UnsignedInt,
  maxSizeRequest: 10000000 as UnsignedInt,
  maxConcurrentRequests: 4 as UnsignedInt,
  maxCallsInRequest: 16 as UnsignedInt,
  maxObjectsInGet: 500 as UnsignedInt,
  maxObjectsInSet: 500 as UnsignedInt,
  collationAlgorithms: ["i;ascii-numeric", "i;ascii-casemap", "i;unicode-casemap"],
}

// TODO get real account
export function getSession(auth?: AuthResult): Session | ProblemDetails {
  const sessionUrlsOrError = getSessionUrls()
  if (isProblemDetails(sessionUrlsOrError)) {
    return sessionUrlsOrError
  }
  const sessionUrls = sessionUrlsOrError

  // Create a mock account with proper Account structure
  const accountId = "account1" as Id
  const mockAccount: Account = {
    name: "Test Account",
    isPersonal: true,
    isReadOnly: false,
    accountCapabilities: {},
  }

  const accounts: Accounts = {
    [accountId]: mockAccount,
  }

  const session: Session = {
    capabilities: {
      [capabilities.core]: capabilityJmapCore,
    },
    accounts: accounts,
    primaryAccounts: {
      [accountId]: accountId,
    },
    username: auth?.username || "testuser",
    apiUrl: sessionUrls.apiUrl,
    downloadUrl: sessionUrls.downloadUrl,
    uploadUrl: sessionUrls.uploadUrl,
    eventSourceUrl: sessionUrls.eventSourceUrl,
    state: "todo",
  }

  return session
}

function getSessionUrls(): SessionUrls | ProblemDetails {
  const rawBaseUrl = process.env.BASE_URL
  if (!rawBaseUrl || rawBaseUrl.trim().length === 0) {
    return createProblemDetails({
      type: errorTypes.internalServerError,
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      detail: "BASE_URL environment variable is missing",
    })
  }

  const baseUrl = rawBaseUrl.replace(/\/+$/, "")

  const downloadUrl = process.env.DOWNLOAD_URL
  if (!downloadUrl || downloadUrl.trim().length === 0) {
    return createProblemDetails({
      type: errorTypes.internalServerError,
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      detail: "DOWNLOAD_URL environment variable is missing",
    })
  }
  const eventSourceUrl = process.env.EVENT_SOURCE_URL
  if (!eventSourceUrl || eventSourceUrl.trim().length === 0) {
    return createProblemDetails({
      type: errorTypes.internalServerError,
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      detail: "EVENT_SOURCE_URL environment variable is missing",
    })
  }
  const uploadUrl = process.env.UPLOAD_URL
  if (!uploadUrl || uploadUrl.trim().length === 0) {
    return createProblemDetails({
      type: errorTypes.internalServerError,
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      detail: "UPLOAD_URL environment variable is missing",
    })
  }

  return {
    apiUrl: `${baseUrl}/jmap`,
    downloadUrl: downloadUrl,
    uploadUrl: uploadUrl,
    eventSourceUrl: eventSourceUrl,
  }
}
