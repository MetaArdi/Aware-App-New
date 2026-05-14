import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate              = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      const stored = JSON.parse(localStorage.getItem('user') || 'null')
      if (stored) setUser(stored)
    }
    setLoading(false)
  }, [])

  const login = async (employee_number, password) => {
    const res = await api.post('/auth/login', { employee_number, password })
    const { access_token, role, employee_id, name } = res.data
    const userData = { role, employee_id, name, employee_number }
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    if (role === 'employee') navigate('/screening')
    else navigate('/dashboard')
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)