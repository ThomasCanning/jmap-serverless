/**
 * API utility functions for making authenticated requests
 */

// API base URL: prefer VITE_API_URL; in dev default to local API on 3001; else same-origin
export const getApiBaseUrl = (): string => {
  return (
    (import.meta.env.VITE_API_URL as string | undefined) ??
    (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin)
  )
}

export interface Session {
  apiUrl: string
  capabilities: Record<string, unknown>
  primaryAccounts: Record<string, string>
}

export interface ApiError {
  error: string
}

/**
 * Fetches the JMAP session using Bearer authentication (cookie-based)
 * Automatically redirects to login if authentication fails (token expired and refresh failed)
 */
export async function fetchSession(): Promise<Session> {
  const apiBaseUrl = getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/.well-known/jmap`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include', // Include cookies for Bearer auth
  })

  if (!response.ok) {
    // If authentication failed (401/403), redirect to login page
    if (response.status === 401 || response.status === 403) {
      // Clear any stale cookies
      await logout()
      // Redirect to login
      window.location.href = '/'
      // Return a promise that never resolves (page will redirect)
      return new Promise(() => {})
    }
    
    // For other errors, throw normally
    const errorText = await response.text()
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errorJson = JSON.parse(errorText) as ApiError
      errorMessage = errorJson.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }
    throw new Error(errorMessage)
  }

  return response.json() as Promise<Session>
}

/**
 * Logs in using Basic authentication
 */
export async function loginWithBasic(
  email: string,
  password: string
): Promise<Session> {
  const apiBaseUrl = getApiBaseUrl()
  const authHeader = `Basic ${btoa(`${email}:${password}`)}`
  const response = await fetch(`${apiBaseUrl}/.well-known/jmap`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
    credentials: 'include', // Important: include cookies
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errorJson = JSON.parse(errorText) as ApiError
      errorMessage = errorJson.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }
    throw new Error(errorMessage)
  }

  return response.json() as Promise<Session>
}

/**
 * Logs out by clearing the authentication cookie
 */
export async function logout(): Promise<void> {
  const apiBaseUrl = getApiBaseUrl()
  await fetch(`${apiBaseUrl}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}
