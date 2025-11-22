import { Id, UnsignedInt } from "../types"

export type Session = {
  capabilities: Capabilities
  accounts: Accounts
  primaryAccounts: {
    [key: string]: Id
  }
  username: string
  apiUrl: string
  downloadUrl: string
  uploadUrl: string
  eventSourceUrl: string
  state: string
}

export type SessionUrls = {
  apiUrl: string
  downloadUrl: string
  uploadUrl: string
  eventSourceUrl: string
}

export type Capabilities = Record<string, Record<string, unknown>>

export interface Account {
  name: string
  isPersonal: boolean
  isReadOnly: boolean
  accountCapabilities: Capabilities
}

export type Accounts = Record<Id, Account>

export type CapabilityJmapCore = {
  maxSizeUpload: UnsignedInt
  maxConcurrentUpload: UnsignedInt
  maxSizeRequest: UnsignedInt
  maxConcurrentRequests: UnsignedInt
  maxCallsInRequest: UnsignedInt
  maxObjectsInGet: UnsignedInt
  maxObjectsInSet: UnsignedInt
  collationAlgorithms: string[]
}

export const capabilities = {
  core: "urn:ietf:params:jmap:core",
} as const
