import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { Eye, EyeOff, Sun, Moon, AlertCircle } from 'lucide-react'
import { useUserStore } from '../store/useUserStore'
import { useTheme } from '../hooks/useTheme'
import { signup, login } from '../lib/auth'
import { jwtDecode } from "jwt-decode";
import type { DecodedToken } from '../types/auth';

function Auth() {
  const navigate = useNavigate()
  const setUser = useUserStore((state) => state.setUser)
  const { theme, setTheme } = useTheme()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  //const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Read error from URL if redirected back from Google with an error
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err === 'unauthorized_domain') {
      const domain = params.get('domain') ?? 'your domain'
      return `Access restricted. Only @singularitynet.io email addresses are allowed. You signed in with @${domain}.`
    }
    return ''
  })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      /*
      if (mode === 'signup') {
        // Validate password confirmation
        if (password !== passwordConfirmation) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }

        const response = await signup(email, password)
        console.log('Signup successful:', response.user_id)
        
        const loginResponse = await login(email, password)
        const decoded: DecodedToken = jwtDecode(loginResponse.access_token)
        
        setUser(email, response.user_id)
        
        if ((decoded.role || '').toLowerCase() === 'admin') {
          navigate('/admin')
        } else {
          navigate('/chat')
        }
      } else {
        */
        const loginResponse = await login(email, password)
        const decoded: DecodedToken = jwtDecode(loginResponse.access_token);
        
        setUser(email, decoded.sub)

        if ((decoded.role || '').toLowerCase() === 'admin') {
          navigate('/admin')
        } else {
          navigate('/chat')
        }
      //}
    } catch (err: any) {
      console.error('Auth error:', err)
      setError(
        err.response?.data?.detail || 
        err.message || 
        'An error occurred. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 transition-colors">
      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="fixed top-4 right-4 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <Moon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        ) : (
          <Sun className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        )}
      </button>
      
      <div className="w-full max-w-md">
        <div className="flex border border-zinc-200 dark:border-zinc-800 rounded-t-md overflow-hidden relative">
          <div 
            className={`absolute bottom-0 left-0 h-0.5 bg-zinc-900 dark:bg-zinc-100 transition-all duration-300 ease-in-out ${
              mode === 'login' ? 'w-1/2 translate-x-0' : 'w-1/2 translate-x-full'
            }`}
          />
          <button
            className={`flex-1 py-3 text-sm font-medium transition-all duration-300 ${
              mode === 'login'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            Sign In
          </button>
          { <button
            className={`flex-1 py-3 text-sm font-medium transition-all duration-300 ${
              mode === 'signup'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                : 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
            onClick={() => {
              setMode('signup')
              setError('')
            }}
          >
            Sign Up
          </button> }
        </div>

        {mode === 'login' ? (
          <Card className="rounded-t-none bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl text-zinc-900 dark:text-zinc-100">Sign In</CardTitle>
              <CardDescription className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
                Enter your email below to login to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-zinc-900 dark:text-zinc-100">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-zinc-900 dark:text-zinc-100">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500">or</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.location.href = 'http://localhost:8000/api/auth/google'}
                  className="w-full flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-md py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Sign in with Google
                </button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-t-none bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl text-zinc-900 dark:text-zinc-100">Sign Up</CardTitle>
              <CardDescription className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
                Enter your information to create an account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email-signup" className="text-zinc-900 dark:text-zinc-100">Email</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup" className="text-zinc-900 dark:text-zinc-100">Password</Label>
                  <div className="relative">
                    <Input
                      id="password-signup"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-confirm" className="text-zinc-900 dark:text-zinc-100">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="password-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm Password"
                      required
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      disabled={isLoading}
                      className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating account...' : 'Create an account'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default Auth
