import { Component, createContext, useContext, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Upload from './pages/Upload'
import Library from './pages/Library'
import ReadingRoom from './pages/ReadingRoom'
import TopBar from './components/TopBar'

// ─── Error boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16, padding: '2rem',
          fontFamily: "'Cormorant Garamond', serif",
        }}>
          <p style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }}>
            Something went wrong.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              border: '1px solid var(--gold)', color: 'var(--gold)',
              background: 'transparent', fontFamily: "'Crimson Pro', serif",
              fontSize: 13, padding: '8px 24px', cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Theme context ────────────────────────────────────────────────────────────
export const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} })
export const useTheme = () => useContext(ThemeContext)


function UploadPage() {
  const navigate = useNavigate()
  return <Upload onSuccess={(bookFolder) => navigate(`/reading-room/${bookFolder}`)} />
}


// ─── Inner app — needs useLocation so must live inside BrowserRouter ──────────
function InnerApp() {
  const location = useLocation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar />
      <div key={location.pathname} className="page-transition" style={{ flex: 1, overflow: 'auto' }}>
        <Routes location={location}>
          <Route path="/"                           element={<Library />} />
          <Route path="/upload"                     element={<UploadPage />} />
          <Route path="/reading-room/:bookFolder"   element={<ReadingRoom />} />
        </Routes>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ErrorBoundary>
        <BrowserRouter>
          <InnerApp />
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeContext.Provider>
  )
}
