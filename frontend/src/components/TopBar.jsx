import { Link, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../App'

function useBreadcrumb() {
  const { pathname } = useLocation()

  if (pathname === '/') {
    return [{ label: 'Library', href: null }]
  }
  if (pathname === '/upload') {
    return [
      { label: 'Library', href: '/' },
      { label: 'Upload', href: null },
    ]
  }
  if (pathname.startsWith('/reading-room/')) {
    const folder = pathname.split('/reading-room/')[1] || ''
    const title = folder.replace(/_/g, ' ') || 'Reading Room'
    return [
      { label: 'Library', href: '/' },
      { label: title, href: null },
    ]
  }
  return [{ label: 'Library', href: '/' }]
}

export default function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const crumbs = useBreadcrumb()

  return (
    <header style={styles.bar}>
      {/* Logo */}
      <Link to="/" style={styles.logo}>
        <span style={styles.logoDecor}>❧</span>
        <span style={styles.logoText}>The Folio</span>
        <span style={styles.logoDecor}>❧</span>
      </Link>

      {/* Breadcrumb */}
      <nav style={styles.breadcrumb} aria-label="breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={crumb.label} style={styles.crumbGroup}>
            {i > 0 && <span style={styles.sep}>›</span>}
            {crumb.href ? (
              <Link to={crumb.href} style={styles.crumbLink}>
                {crumb.label}
              </Link>
            ) : (
              <span style={styles.crumbActive}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={styles.toggle}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark'
          ? <Sun size={17} strokeWidth={1.5} />
          : <Moon size={17} strokeWidth={1.5} />
        }
      </button>
    </header>
  )
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '64px',
    padding: '0 2rem',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--gold)',
    position: 'relative',
    zIndex: 100,
    flexShrink: 0,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    textDecoration: 'none',
    color: 'var(--gold)',
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "'Cinzel', serif",
    fontWeight: 600,
    fontSize: '1.15rem',
    letterSpacing: '0.12em',
    color: 'var(--gold)',
    textTransform: 'uppercase',
  },
  logoDecor: {
    fontSize: '0.9rem',
    color: 'var(--gold-muted)',
    opacity: 0.75,
    lineHeight: 1,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  crumbGroup: {
    display: 'flex',
    alignItems: 'center',
  },
  sep: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '1.1rem',
    color: 'var(--gold-muted)',
    margin: '0 0.5rem',
    opacity: 0.7,
  },
  crumbLink: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '1rem',
    fontWeight: 400,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    letterSpacing: '0.03em',
    transition: 'color 0.2s ease',
  },
  crumbActive: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '1rem',
    fontWeight: 500,
    color: 'var(--text)',
    letterSpacing: '0.03em',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    color: 'var(--gold)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'border-color 0.2s ease, background 0.2s ease',
  },
}
