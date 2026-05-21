import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const COVER_PALETTES = [
  { bg: '#12172e', spine: 'rgba(201,168,76,0.55)'  },
  { bg: '#1c0f1a', spine: 'rgba(190,110,150,0.55)' },
  { bg: '#0c1a10', spine: 'rgba(90,170,110,0.55)'  },
  { bg: '#09181e', spine: 'rgba(70,180,200,0.55)'  },
  { bg: '#1a1208', spine: 'rgba(210,155,60,0.60)'  },
]

function folderColorIndex(folder) {
  let h = 0
  for (let i = 0; i < folder.length; i++) h = (h * 31 + folder.charCodeAt(i)) >>> 0
  return h % COVER_PALETTES.length
}

function partsLabel(total, audioReady) {
  if (audioReady === total) return 'Complete'
  const remaining = total - audioReady
  return `${remaining} part${remaining !== 1 ? 's' : ''} remaining`
}

function chunk(arr, size) {
  const rows = []
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size))
  return rows
}

export default function Library() {
  const navigate = useNavigate()
  const [books, setBooks] = useState(null)
  const [hoveredFolder, setHoveredFolder] = useState(null)
  const [confirmFolder, setConfirmFolder] = useState(null)
  const [plusHovered, setPlusHovered] = useState(false)

  useEffect(() => {
    fetch('http://localhost:8000/books')
      .then(r => r.ok ? r.json() : [])
      .then(data => setBooks(data))
      .catch(() => setBooks([]))
  }, [])

  function handleDeleteClick(folder, e) {
    e.stopPropagation()
    if (confirmFolder === folder) {
      fetch(`http://localhost:8000/book/${folder}`, { method: 'DELETE' })
        .then(r => { if (r.ok) setBooks(prev => prev.filter(b => b.folder !== folder)) })
      setConfirmFolder(null)
    } else {
      setConfirmFolder(folder)
    }
  }

  function handleCardLeave(folder) {
    setHoveredFolder(null)
    if (confirmFolder === folder) setConfirmFolder(null)
  }

  // ── loading skeleton ──────────────────────────────────────────────────────────
  if (books === null) {
    return (
      <>
        <style>{`@keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.75}}`}</style>
        <div style={S.container}>
          <div style={S.section}>
            <div style={S.pageHeading}>Your Library</div>
            <div style={S.headingRule} />
            <div style={S.shelfRow}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ ...S.skeletonCard, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── build card list & chunk into rows of 4 ───────────────────────────────────
  const allCards = [{ type: 'plus' }, ...books.map(b => ({ type: 'book', ...b }))]
  const rows = chunk(allCards, 4)

  return (
    <div style={S.container}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} style={S.section}>
          {rowIdx === 0 && (
            <>
              <div style={S.pageHeading}>Your Library</div>
              <div style={S.headingRule} />
            </>
          )}

          <div style={S.shelfRow}>
            {row.map(card => {
              if (card.type === 'plus') {
                return (
                  <div
                    key="plus"
                    style={S.bookWrap}
                    onClick={() => navigate('/upload')}
                    onMouseEnter={() => setPlusHovered(true)}
                    onMouseLeave={() => setPlusHovered(false)}
                  >
                    <div style={{
                      ...S.plusInner,
                      borderColor: plusHovered ? 'var(--gold-muted)' : 'var(--border)',
                      transform: plusHovered ? 'translateY(-6px)' : 'none',
                      boxShadow: plusHovered ? '0 18px 48px rgba(0,0,0,0.4)' : 'none',
                      transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                    }}>
                      <div style={{ ...S.plusIcon, color: plusHovered ? 'var(--gold-muted)' : 'var(--border)' }}>+</div>
                      <div style={{ ...S.plusLabel, color: plusHovered ? 'var(--gold-muted)' : 'var(--border)' }}>Upload a Book</div>
                    </div>
                  </div>
                )
              }

              const palette = COVER_PALETTES[folderColorIndex(card.folder)]
              const isHov = hoveredFolder === card.folder
              const isCon = confirmFolder === card.folder

              return (
                <div
                  key={card.folder}
                  style={S.bookWrap}
                  onMouseEnter={() => setHoveredFolder(card.folder)}
                  onMouseLeave={() => handleCardLeave(card.folder)}
                  onClick={() => navigate(`/reading-room/${card.folder}`)}
                >
                  <div style={{
                    ...S.bookInner,
                    background: palette.bg,
                    borderColor: isHov ? 'var(--gold)' : palette.spine,
                    borderLeftColor: isHov ? 'var(--gold)' : palette.spine,
                    transform: isHov ? 'translateY(-6px)' : 'none',
                    boxShadow: isHov ? '0 18px 48px rgba(0,0,0,0.65)' : 'none',
                  }}>
                    <div style={S.bookTitle}>{card.title}</div>
                    <div style={S.bookDivider} />
                    <div style={S.bookMeta}>{partsLabel(card.total_parts, card.audio_ready_count)}</div>
                  </div>

                  <div
                    style={{
                      ...S.deleteBar,
                      opacity: isHov || isCon ? 1 : 0,
                      pointerEvents: isHov || isCon ? 'all' : 'none',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {isCon ? (
                      <>
                        <span style={S.confirmLabel}>Confirm?</span>
                        <button style={S.confirmYes} onClick={e => handleDeleteClick(card.folder, e)}>Delete</button>
                      </>
                    ) : (
                      <button style={S.deleteBtn} onClick={e => handleDeleteClick(card.folder, e)}>Delete</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {rowIdx === 0 && books.length === 0 && (
            <div style={S.emptyMsg}>No books yet. Upload a PDF to begin.</div>
          )}
        </div>
      ))}
    </div>
  )
}

const S = {
  container: {
    height: '100%',
    overflowY: 'scroll',
    scrollSnapType: 'y mandatory',
    scrollBehavior: 'smooth',
  },
  section: {
    scrollSnapAlign: 'start',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '36px 48px 28px',
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
  },
  pageHeading: {
    fontFamily: "'Cinzel', serif",
    fontSize: '13px',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '8px',
    flexShrink: 0,
  },
  headingRule: {
    height: '1px',
    background: 'linear-gradient(to right, transparent, var(--gold-muted), transparent)',
    marginBottom: '20px',
    flexShrink: 0,
  },
  shelfRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
    flex: 1,
    minHeight: 0,
    alignItems: 'stretch',
    paddingBottom: '20px',
    borderBottom: '2px solid var(--border)',
    position: 'relative',
  },
  bookWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
    cursor: 'pointer',
  },
  bookInner: {
    width: '100%',
    height: '100%',
    border: '1px solid',
    borderLeft: '5px solid',
    borderRadius: '2px 4px 4px 2px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 18px',
    gap: '14px',
    transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
    position: 'relative',
    overflow: 'hidden',
  },
  bookTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic',
    fontWeight: 600,
    fontSize: '28px',
    color: '#f0e8d2',
    textAlign: 'center',
    lineHeight: 1.35,
    wordBreak: 'break-word',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookDivider: {
    width: '40px',
    height: '1px',
    background: 'var(--gold-muted)',
    flexShrink: 0,
  },
  bookMeta: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '14px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    letterSpacing: '0.3px',
    flexShrink: 0,
  },
  deleteBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    background: 'rgba(10, 14, 26, 0.9)',
    borderTop: '1px solid var(--border)',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'opacity 0.18s',
  },
  deleteBtn: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '11px',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    background: 'transparent',
    border: '1px solid var(--border)',
    padding: '4px 14px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
  confirmLabel: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  confirmYes: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '11px',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: '#e07070',
    background: 'transparent',
    border: '1px solid #e07070',
    padding: '4px 10px',
    cursor: 'pointer',
    borderRadius: '2px',
  },
  plusInner: {
    width: '100%',
    height: '100%',
    border: '1px dashed var(--border)',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  plusIcon: {
    fontSize: '36px',
    lineHeight: 1,
    fontWeight: 300,
  },
  plusLabel: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: '12px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  skeletonCard: {
    width: '100%',
    height: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderLeft: '5px solid var(--border)',
    borderRadius: '2px 4px 4px 2px',
    animation: 'shimmer 1.5s ease-in-out infinite',
  },
  emptyMsg: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.1rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: '32px',
    fontStyle: 'italic',
  },
}
