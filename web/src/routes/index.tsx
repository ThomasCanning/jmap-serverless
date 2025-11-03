import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { loginWithBasic, getApiBaseUrl } from '@/lib/api'

export const Route = createFileRoute('/')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({})

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginWithBasic(email, password),
    onSuccess: () => {
      // Navigate to session page on successful login
      navigate({ to: '/session' })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Custom validation
    const errors: { email?: string; password?: string } = {}
    if (!email.trim()) {
      errors.email = 'Email or username is required'
    }
    if (!password) {
      errors.password = 'Password is required'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors({})
    loginMutation.mutate({ email, password })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">JMAP Login</h1>
          <p className="text-muted-foreground">Sign in to your JMAP server</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pb-6">
              {loginMutation.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {loginMutation.error instanceof Error
                      ? loginMutation.error.message
                      : 'Login failed'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email / Username</Label>
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (validationErrors.email) {
                      setValidationErrors((prev) => ({ ...prev, email: undefined }))
                    }
                  }}
                  disabled={loginMutation.isPending}
                  placeholder="user@example.com"
                  autoComplete="username"
                  aria-invalid={!!validationErrors.email}
                />
                {validationErrors.email && (
                  <p className="text-sm text-destructive">{validationErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (validationErrors.password) {
                      setValidationErrors((prev) => ({ ...prev, password: undefined }))
                    }
                  }}
                  disabled={loginMutation.isPending}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={!!validationErrors.password}
                />
                {validationErrors.password && (
                  <p className="text-sm text-destructive">{validationErrors.password}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button type="submit" disabled={loginMutation.isPending} className="w-full">
                {loginMutation.isPending ? 'Logging in...' : 'Login'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          API Base: <code className="bg-muted px-1 py-0.5 rounded">{getApiBaseUrl()}</code>
        </div>
      </div>
    </div>
  )
}