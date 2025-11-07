import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { useUserStore } from '../store/useUserStore'

function LoginSignupPage() {
  const navigate = useNavigate()
  const setUser = useUserStore((state) => state.setUser)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Save user info to store - username extracted from email
    setUser(email)
    navigate('/chat')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="flex border border-gray-800 rounded-t-md overflow-hidden relative">
          <div 
            className={`absolute bottom-0 left-0 h-0.5 bg-white transition-all duration-300 ease-in-out ${
              mode === 'login' ? 'w-1/2 translate-x-0' : 'w-1/2 translate-x-full'
            }`}
          />
          <button
            className={`flex-1 py-3 text-sm font-medium transition-all duration-300 ${
              mode === 'login'
                ? 'bg-gray-900 text-white'
                : 'bg-transparent text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-all duration-300 ${
              mode === 'signup'
                ? 'bg-gray-900 text-white'
                : 'bg-transparent text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {mode === 'login' ? (
          <Card className="rounded-t-none bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl text-white">Sign In</CardTitle>
              <CardDescription className="text-xs md:text-sm text-gray-400">
                Enter your email below to login to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200">
                  Login
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-t-none bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl text-white">Sign Up</CardTitle>
              <CardDescription className="text-xs md:text-sm text-gray-400">
                Enter your information to create an account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-signup" className="text-white">Email</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup" className="text-white">Password</Label>
                  <div className="relative">
                    <Input
                      id="password-signup"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-confirm" className="text-white">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="password-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm Password"
                      required
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200">
                  Create an account
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default LoginSignupPage
