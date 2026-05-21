import { useRef, useState } from 'react'
import { UploadCloud, AlertTriangle, RefreshCw } from 'lucide-react'

const MAX_BYTES = 50 * 1024 * 1024

export default function Upload({ onSuccess }) {
  const [view, setView]                 = useState('drop')   // drop | confirm | loading | error
  const [dragOver, setDragOver]         = useState(false)
  const [hovered, setHovered]           = useState(false)
  const [titleGuess, setTitleGuess]     = useState('')
  const [confirmedTitle, setConfirmedTitle] = useState('')
  const [bookFolder, setBookFolder]     = useState('')
  const [error, setError]               = useState('')
  const [errorType, setErrorType]       = useState('')       // 'upload' | 'analyze'
  const fileInputRef                    = useRef(null)

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  async function processFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      setErrorType('upload')
      setView('error')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('PDF exceeds 50MB limit.')
      setErrorType('upload')
      setView('error')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setView('loading')
    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Upload failed.')
        setErrorType('upload')
        setView('error')
        return
      }
      setTitleGuess(data.title_guess)
      setConfirmedTitle(data.title_guess)
      setBookFolder(data.book_folder)
      setView('confirm')
    } catch {
      setError('Could not reach the backend. Is the server running?')
      setErrorType('upload')
      setView('error')
    }
  }

  async function handleConfirm() {
    setView('loading')
    try {
      const res = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_folder: bookFolder, confirmed_title: confirmedTitle }),
      })
      let data = null
      try { data = await res.json() } catch { /* non-JSON body */ }
      if (!res.ok) {
        setError(data?.detail || 'Analysis failed.')
        setErrorType('analyze')
        setView('error')
        return
      }
      onSuccess(data.book_folder)
    } catch {
      setError('Could not reach the backend. Is the server running?')
      setErrorType('analyze')
      setView('error')
    }
  }

  function handleRetry() {
    if (errorType === 'upload') {
      setView('drop')
      setError('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else {
      handleConfirm()
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Page heading */}
        <h1 style={s.heading}>Upload a Book</h1>
        <div style={s.rule} />

        {/* ── Drop zone ── */}
        {view === 'drop' && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              ...s.dropZone,
              borderColor: (dragOver || hovered) ? 'var(--gold)' : 'var(--gold-muted)',
              background:  (dragOver || hovered) ? 'var(--surface-raised)' : 'transparent',
            }}
          >
            <UploadCloud
              size={40}
              strokeWidth={1}
              color={(dragOver || hovered) ? 'var(--gold)' : 'var(--gold-muted)'}
              style={{ marginBottom: '1rem', transition: 'color 0.2s ease' }}
            />
            <p style={s.dropPrimary}>Drop a PDF here</p>
            <p style={s.dropSecondary}>or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* ── Confirm title ── */}
        {view === 'confirm' && (
          <div style={s.confirmWrap}>
            <p style={s.confirmLabel}>Confirm book title</p>
            <input
              type="text"
              value={confirmedTitle}
              onChange={(e) => setConfirmedTitle(e.target.value)}
              style={s.input}
              autoFocus
            />
            <button
              onClick={handleConfirm}
              disabled={!confirmedTitle.trim()}
              style={{
                ...s.btn,
                opacity:       confirmedTitle.trim() ? 1 : 0.4,
                cursor:        confirmedTitle.trim() ? 'pointer' : 'default',
                pointerEvents: confirmedTitle.trim() ? 'auto' : 'none',
              }}
            >
              Confirm &amp; Analyse
            </button>
          </div>
        )}

        {/* ── Loading ── */}
        {view === 'loading' && (
          <div style={s.loadingWrap}>
            <div style={s.spinner} />
            <p style={s.loadingText}>Analyzing your book…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Error ── */}
        {view === 'error' && (
          <div style={s.errorWrap}>
            <AlertTriangle size={32} strokeWidth={1.5} color="var(--gold-muted)" style={{ marginBottom: '1rem' }} />
            <p style={s.errorText}>{error}</p>
            <div style={s.errorActions}>
              {errorType === 'analyze' && (
                <button onClick={handleRetry} style={s.btn}>
                  <RefreshCw size={14} strokeWidth={1.5} style={{ marginRight: '0.4rem' }} />
                  Retry
                </button>
              )}
              <button
                onClick={() => { setView('drop'); setError('') }}
                style={{ ...s.btn, ...s.btnGhost }}
              >
                Try Different PDF
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const s = {
  page: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      'calc(100vh - 64px)',
    padding:        '2rem',
  },
  card: {
    width:         '100%',
    maxWidth:      '480px',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           '1.5rem',
  },
  heading: {
    fontFamily:    "'Cinzel', serif",
    fontWeight:    600,
    fontSize:      '1.45rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color:         'var(--text)',
    margin:        0,
    textAlign:     'center',
  },
  rule: {
    width:      '100%',
    height:     '1px',
    background: 'linear-gradient(to right, transparent, var(--gold), transparent)',
    opacity:    0.4,
  },
  dropZone: {
    width:          '100%',
    border:         '1px dashed',
    borderRadius:   '2px',
    padding:        '3.5rem 2rem',
    cursor:         'pointer',
    textAlign:      'center',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    transition:     'border-color 0.2s ease, background 0.2s ease',
  },
  dropPrimary: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize:   '1.2rem',
    color:      'var(--text)',
    margin:     0,
  },
  dropSecondary: {
    fontFamily: "'Crimson Pro', serif",
    fontSize:   '0.95rem',
    color:      'var(--text-muted)',
    marginTop:  '0.35rem',
  },
  confirmWrap: {
    width:         '100%',
    display:       'flex',
    flexDirection: 'column',
    gap:           '1rem',
  },
  confirmLabel: {
    fontFamily: "'Crimson Pro', serif",
    fontSize:   '1rem',
    color:      'var(--text-muted)',
    margin:     0,
  },
  input: {
    width:           '100%',
    padding:         '0.65rem 0.9rem',
    fontFamily:      "'Cormorant Garamond', serif",
    fontSize:        '1.1rem',
    color:           'var(--text)',
    background:      'var(--surface-raised)',
    border:          '1px solid var(--border)',
    borderRadius:    '2px',
    outline:         'none',
    boxSizing:       'border-box',
    transition:      'border-color 0.2s ease',
  },
  btn: {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontFamily:     "'Crimson Pro', serif",
    fontSize:       '1rem',
    fontWeight:     500,
    letterSpacing:  '0.06em',
    color:          'var(--gold)',
    background:     'transparent',
    border:         '1px solid var(--gold)',
    borderRadius:   '2px',
    padding:        '0.55rem 1.75rem',
    cursor:         'pointer',
    transition:     'background 0.2s ease, color 0.2s ease',
    alignSelf:      'flex-start',
  },
  btnGhost: {
    color:       'var(--text-muted)',
    borderColor: 'var(--border)',
  },
  loadingWrap: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            '1.25rem',
    padding:        '2rem 0',
  },
  spinner: {
    width:        '36px',
    height:       '36px',
    border:       '2px solid var(--border)',
    borderTop:    '2px solid var(--gold)',
    borderRadius: '50%',
    animation:    'spin 0.9s linear infinite',
  },
  loadingText: {
    fontFamily:  "'Cormorant Garamond', serif",
    fontSize:    '1.15rem',
    fontStyle:   'italic',
    color:       'var(--text-muted)',
    margin:      0,
  },
  errorWrap: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    textAlign:      'center',
    gap:            '0.75rem',
    padding:        '1rem 0',
  },
  errorText: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize:   '1.1rem',
    color:      'var(--text-muted)',
    margin:     0,
    lineHeight: 1.6,
  },
  errorActions: {
    display:   'flex',
    gap:       '1rem',
    marginTop: '0.5rem',
    flexWrap:  'wrap',
    justifyContent: 'center',
  },
}
