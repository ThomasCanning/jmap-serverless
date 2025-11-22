import { Invocation, Id, Int, UnsignedInt, JsonValue } from "../types"

export type JmapRequest = {
  using: string[] //capabilities
  methodCalls: Invocation[]
  createdIds?: Record<Id, Id> // map from client specified creation id to the id the server assigned when a record was successfully created
}

export type JmapResponse = {
  methodResponses: Invocation[]
  createdIds?: Record<Id, Id>
  sessionState: string
}

export type ResultReference = {
  resultOf: string
  name: string
  path: string
}

//TODO we can likely replace JSON type with unions of objects

export type GetRequestArgs = {
  accountId: Id
  ids?: Id[] | null //Ids of object to return, null = all if supported and doesn't exceed limit
  properties?: string[] | null //optionally restrict properties returned
}

export type GetResponseArgs = {
  accountId: Id
  state: string //Change means client must refetch
  list: JsonValue[]
  notFound: Id[]
}

export type ChangesRequestArgs = {
  accountId: Id
  sinceState: string //Return changes since this state
  maxChanges?: UnsignedInt | null
}

export type ChangesResponseArgs = {
  accountId: Id
  oldState: string //since state echoed back
  newState: string
  hasMoreChanges: boolean //false if new state is current state
  created: Id[]
  updated: Id[]
  destroyed: Id[]
}

export type SetRequestArgs = {
  accountId: Id
  ifInState?: string | null
  create?: Record<Id, JsonValue> | null
  update?: Record<Id, PatchObject> | null
  destroy?: Id[] | null
}

export type SetResponseArgs = {
  accountId: Id
  oldState?: string | null
  newState: string
  created?: Record<Id, JsonValue> | null
  updated?: Record<Id, JsonValue | null> | null
  destroyed?: Id[] | null
  notCreated?: Record<Id, SetError> | null
  notUpdated?: Record<Id, SetError> | null
  notDestroyed?: Record<Id, SetError> | null
}

export type PatchObject = Record<string, JsonValue>

export type SetError = {
  type: SetErrorType
  description?: string | null
  properties?: string[] //lists all properties that were invalid
  existingId?: Id | null
}

export const setErrors = {
  forbidden: "forbidden",
  overQuota: "overQuota", //exceeeds number or total size of objects of this type
  tooLarge: "tooLarge", //exceeds maximum size of a single object of this type
  rateLimit: "rateLimit", //too many objects of this type created recently
  notFound: "notFound",
  invalidPatch: "invalidPatch",
  willDestroy: "willDestroy", //requested update and destroy in same /set, so ignore update
  invalidProperties: "invalidProperties",
  singleton: "singleton", //can't create another or destroy existing
  alreadyExists: "alreadyExists",
} as const

export type SetErrorType = (typeof setErrors)[keyof typeof setErrors]

export type CopyRequestArgs = {
  fromAccountId: Id
  ifFromInState?: string | null //if supplied, must match current state of account referenced by ifFromInState otherwise state mismatch
  accountId: Id //account to copy to
  ifInState?: string | null //must match accountId state
  create: Record<Id, JsonValue>
  onSuccessDestroyOriginal?: boolean //default true
  destroyFromIfInState?: string | null
}

export type CopyResponseArgs = {
  fromAccountId: Id
  accountId: Id
  oldState?: string | null
  newState: string
  created?: Record<Id, JsonValue> | null
  notCreated?: Record<Id, SetError> | null
}

export type QueryRequestArgs<T extends Record<string, unknown> = Record<string, unknown>> = {
  accountId: Id
  filter?: FilterOperator<T> | FilterCondition<T> | null
  sort?: Comparator[] | null //lists names of properties to compare
  position?: Int //default 0
  anchor?: Id | null //ignore position if supplied
  anchorOffset?: Int //default 0
  limit?: UnsignedInt | null
  calculateTotal?: boolean //default false
}

export type QueryResponseArgs = {
  accountId: Id
  queryState: string
  canCalculateChanges: boolean
  position: UnsignedInt
  ids: Id[]
  total?: UnsignedInt
  limit?: UnsignedInt
}

export const operators = {
  AND: "AND",
  OR: "OR",
  NOT: "NOT",
} as const

export type Operator = (typeof operators)[keyof typeof operators]

export type FilterOperator<T extends Record<string, unknown> = Record<string, unknown>> = {
  operator: Operator
  conditions: (FilterOperator<T> | FilterCondition<T>)[]
}

export type FilterCondition<T extends Record<string, unknown> = Record<string, unknown>> =
  Partial<T> & {
    operator?: never
  }

export type Comparator = {
  property: string
  isAscending?: boolean //default true
  collation?: string
}

export type QueryChangesRequestArgs<T extends Record<string, unknown> = Record<string, unknown>> = {
  accountId: Id
  filter?: FilterOperator<T> | FilterCondition<T> | null
  sort?: Comparator[] | null
  sinceQueryState: string
  maxChanges?: UnsignedInt | null
  upToId?: Id | null
  calculateTotal?: boolean //default false
}

export type QueryChangesResponseArgs = {
  accountId: Id
  oldQueryState: string
  newQueryState: string
  total?: UnsignedInt
  removed: Id[]
  added: AddedItem[]
}

export type AddedItem = {
  id: Id
  index: UnsignedInt
}
