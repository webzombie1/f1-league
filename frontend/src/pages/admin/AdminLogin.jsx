import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, post } from '../../api'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    get('/auth/check')
      .then(() => navigate('/admin/seasons'))
      .catch(() => {})
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password.trim() || loading) return
    setLoading(true)
    setError('')

    try {
      await post('/auth/login', { password })
      navigate('/admin/seasons')
    } catch {
      setError('Wrong password.')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#7ED321] mb-2">Admin</h1>
          <p className="text-[#8892A8] text-sm">GDR League Management</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full bg-[#1E2642] border border-[#2A3458] rounded-xl px-4 py-3 text-sm text-[#E8ECF4] placeholder-[#555F78] focus:outline-none focus:border-[#7ED321] focus:ring-1 focus:ring-[#7ED321]"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-[#7ED321] hover:bg-[#6BC11A] disabled:bg-[#2A3458] disabled:text-[#555F78] text-[#141A2E] font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {loading ? 'Verifying...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
