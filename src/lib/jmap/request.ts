import { Id, JmapRequest, JmapResponse } from "./types"

export function processRequest(request: JmapRequest): JmapResponse {
  console.log("Processing request", request)

  const mockResponse: JmapResponse = {
    methodResponses: [
      [
        "getMailboxes",
        {
          accountId: "account1",
          mailboxes: [
            {
              id: "1",
            },
          ],
        },
        "1",
      ],
    ],
    createdIds: {
      id: "123",
    } as Record<Id, Id>,
    sessionState: "1",
  }

  return mockResponse
}
