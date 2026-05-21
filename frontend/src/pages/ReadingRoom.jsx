import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Circle, Download, Pause, Play, RotateCcw, RotateCw, ScrollText, Star } from 'lucide-react'

function getIconStatus(part, stateMap) {
  if (part.is_generating) return 'generating'
  const s = stateMap[String(part.part_number)]
  if (s === 'audio_ready') return 'audio_ready'
  if (s === 'script_ready') return 'script_ready'
  return 'empty'
}

function renderStatusIcon(status, throbbing = false) {
  if (status === 'generating') {
    return (
      <Circle
        size={14} strokeWidth={1.5} color="var(--gold)"
        style={{ animation: 'blink-pulse 1.2s ease-in-out infinite', flexShrink: 0 }}
      />
    )
  }
  if (status === 'script_ready') {
    return <Circle size={14} strokeWidth={1.5} color="var(--gold)" fill="var(--gold)" style={{ flexShrink: 0 }} />
  }
  if (status === 'audio_ready') {
    return (
      <Star
        size={14}
        strokeWidth={1.5}
        color="var(--gold)"
        fill="var(--gold)"
        style={{
          flexShrink: 0,
          animation: throbbing ? 'throb 1.4s ease-in-out infinite' : 'none',
        }}
      />
    )
  }
  return <Circle size={14} strokeWidth={1.5} color="var(--gold-muted)" style={{ flexShrink: 0 }} />
}

function sanitizeName(s) {
  return s.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')
}

function getAudioUrl(bookFolder, partNumber, partTitle) {
  const sanitized = sanitizeName(partTitle)
  const partDir = `Part${partNumber}_${sanitized}`
  const filename = `${bookFolder}Part${partNumber}${sanitized}.mp3`
  return `http://localhost:8000/output/${bookFolder}/${partDir}/${filename}`
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatListenTime(wordCount) {
  if (wordCount === null || wordCount === undefined) return '—'
  const mins = Math.round(wordCount / 150)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function renderPartCard(part, stateMap, selectedPartId, generatingPartId, audioGeneratingPartId, onPartClick, isPlaying) {
  const iconStatus = getIconStatus(part, stateMap)
  const isSelected = selectedPartId === part.part_number
  const isLocked =
    (generatingPartId !== null && generatingPartId !== part.part_number) ||
    (audioGeneratingPartId !== null && audioGeneratingPartId !== part.part_number)
  const isThrobbing = isPlaying && isSelected && iconStatus === 'audio_ready'
  return (
    <div
      key={part.part_number}
      onClick={() => onPartClick(part)}
      onMouseEnter={e => {
        if (!isSelected && !isLocked) e.currentTarget.style.background = 'var(--surface-raised)'
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
      style={{
        borderLeft: isSelected ? '3px solid var(--gold)' : '3px solid transparent',
        background: isSelected ? 'var(--surface-raised)' : 'transparent',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        padding: '12px 16px',
        transition: 'background 0.15s',
        opacity: isLocked ? 0.4 : 1,
        pointerEvents: isLocked ? 'none' : 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {renderStatusIcon(iconStatus, isThrobbing)}
        <span style={{
          fontFamily: "'Crimson Pro', serif",
          color: 'var(--text)', fontSize: 15, lineHeight: 1.3
        }}>
          Part {part.part_number}: {part.title}
        </span>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 4, paddingLeft: 22
      }}>
        <span style={{
          fontFamily: "'Crimson Pro', serif",
          color: 'var(--text-muted)', fontSize: 12
        }}>
          {part.chapter_range}
        </span>
        <span style={{
          fontFamily: "'Crimson Pro', serif",
          color: 'var(--text-muted)', fontSize: 12
        }}>
          {formatListenTime(part.word_count)}
        </span>
      </div>
    </div>
  )
}

function getButtonStates(bookData, selectedPartId) {
  if (!bookData || selectedPartId === null) return { reviseActive: false, podcastActive: false }
  const s = bookData.state[String(selectedPartId)]
  return {
    reviseActive: s === 'script_ready' || s === 'audio_ready',
    podcastActive: s === 'script_ready',
  }
}

export default function ReadingRoom() {
  const { bookFolder } = useParams()
  const bookTitle = bookFolder?.replace(/_/g, ' ') || 'Reading Room'

  const [bookData, setBookData] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [selectedPartId, setSelectedPartId] = useState(null)
  const [panelMode, setPanelMode] = useState('idle')
  const [generatingPartId, setGeneratingPartId] = useState(null)
  const [script, setScript] = useState(null)
  const [reviseConfirmPending, setReviseConfirmPending] = useState(false)
  const [audioGeneratingPartId, setAudioGeneratingPartId] = useState(null)
  const [podcastProgress, setPodcastProgress] = useState({ current: 0, total: 0 })
  const [rightTab, setRightTab] = useState('script')

  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const currentTimeRef = useRef(0)
  const savedPositions = useRef({})
  const prevSelectedPartIdRef = useRef(null)

  const quillPosRef = useRef(null)
  const quillRotRef = useRef(null)
  const trailPathRef = useRef(null)
  const trailWrapRef = useRef(null)
  const quillRafRef = useRef(null)
  const quillElapsedRef = useRef(0)
  const quillLastTimeRef = useRef(null)
  const quillCacheRef = useRef(null)

  useEffect(() => {
    if (prevSelectedPartIdRef.current !== null) {
      savedPositions.current[prevSelectedPartIdRef.current] = currentTimeRef.current
    }
    prevSelectedPartIdRef.current = selectedPartId
    setReviseConfirmPending(false)
    setRightTab(bookData?.state[String(selectedPartId)] === 'audio_ready' ? 'player' : 'script')
    if (audioRef.current) audioRef.current.pause()
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    currentTimeRef.current = 0
    quillElapsedRef.current = 0
    quillLastTimeRef.current = null
    quillCacheRef.current = null
    if (quillRafRef.current) cancelAnimationFrame(quillRafRef.current)
    if (panelModeRef.current === 'audio_generating' || panelModeRef.current === 'audio_error') {
      setPanelMode('idle')
      setAudioGeneratingPartId(null)
    }
  }, [selectedPartId])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  function applyQuillFrame(progress) {
    const path = trailPathRef.current
    const pos  = quillPosRef.current
    const rot  = quillRotRef.current
    const wrap = trailWrapRef.current
    if (!path || !pos || !rot || !wrap) return
    if (!quillCacheRef.current) {
      const pl = path.getTotalLength()
      path.style.strokeDasharray = pl
      const ep = path.getPointAtLength(pl)
      const la = path.getPointAtLength(pl - 1)
      const lt = Math.atan2(ep.y - la.y, ep.x - la.x) * 180 / Math.PI
      quillCacheRef.current = { pl, sp: path.getPointAtLength(0), ep, lwt: 45 + lt * 0.35 }
    }
    const { pl, sp, ep, lwt } = quillCacheRef.current
    if (progress < 0.70) {
      const w   = progress / 0.70
      const len = w * pl
      const pt  = path.getPointAtLength(len)
      const a   = path.getPointAtLength(Math.max(0, len - 1))
      const b   = path.getPointAtLength(Math.min(pl, len + 1))
      const tilt = 45 + Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI * 0.35
      pos.setAttribute('transform', `translate(${pt.x} ${pt.y})`)
      rot.setAttribute('transform', `rotate(${tilt})`)
      path.style.strokeDashoffset = pl * (1 - w)
      wrap.style.opacity = 1
      wrap.setAttribute('transform', 'translate(0 0)')
    } else if (progress < 0.80) {
      const f = (progress - 0.70) / 0.10
      pos.setAttribute('transform', `translate(${ep.x} ${ep.y})`)
      rot.setAttribute('transform', `rotate(${lwt + (45 - lwt) * f})`)
      path.style.strokeDashoffset = 0
      wrap.style.opacity = 1 - f
      wrap.setAttribute('transform', `translate(0 ${-25 * f})`)
    } else {
      const s = (progress - 0.80) / 0.20
      const e = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2
      pos.setAttribute('transform', `translate(${ep.x + (sp.x - ep.x) * e} ${ep.y + (sp.y - ep.y) * e})`)
      rot.setAttribute('transform', 'rotate(45)')
      path.style.strokeDashoffset = pl
      wrap.style.opacity = 0
      wrap.setAttribute('transform', 'translate(0 0)')
    }
  }

  function quillLoop(ts) {
    if (quillLastTimeRef.current === null) quillLastTimeRef.current = ts
    quillElapsedRef.current += ts - quillLastTimeRef.current
    quillLastTimeRef.current = ts
    if (quillElapsedRef.current >= 5000) quillElapsedRef.current -= 5000
    applyQuillFrame(quillElapsedRef.current / 5000)
    quillRafRef.current = requestAnimationFrame(quillLoop)
  }

  useEffect(() => {
    if (isPlaying) {
      quillLastTimeRef.current = null
      quillRafRef.current = requestAnimationFrame(quillLoop)
    } else {
      if (quillRafRef.current) cancelAnimationFrame(quillRafRef.current)
    }
    return () => { if (quillRafRef.current) cancelAnimationFrame(quillRafRef.current) }
  }, [isPlaying])

  useEffect(() => {
    const id = setTimeout(() => applyQuillFrame(0), 0)
    return () => clearTimeout(id)
  }, [selectedPartId])

  useEffect(() => {
    function handleKey(e) {
      if (!audioRef.current) return
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        isPlaying ? audioRef.current.pause() : audioRef.current.play()
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10)
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault()
        audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPlaying, duration])

  const panelModeRef = useRef(panelMode)
  useEffect(() => { panelModeRef.current = panelMode }, [panelMode])

  const audioGeneratingPartIdRef = useRef(audioGeneratingPartId)
  useEffect(() => { audioGeneratingPartIdRef.current = audioGeneratingPartId }, [audioGeneratingPartId])

  function fetchScript(partId) {
    fetch(`http://localhost:8000/script/${bookFolder}/${partId}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => {
        setScript(data)
        setPanelMode('script')
        setGeneratingPartId(null)
      })
      .catch(() => {
        setPanelMode('error')
        setGeneratingPartId(null)
      })
  }

  function handlePartClick(part) {
    if (generatingPartId !== null && generatingPartId !== part.part_number) return
    if (audioGeneratingPartId !== null) return
    if (part.is_generating) return
    setSelectedPartId(part.part_number)
    const partState = bookData.state[String(part.part_number)]
    if (partState === 'script_ready' || partState === 'audio_ready') {
      setPanelMode('generating')
      fetchScript(part.part_number)
    } else {
      fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_folder: bookFolder, part_number: part.part_number }),
      }).then(res => {
        if (!res.ok) throw new Error('generate failed')
        setGeneratingPartId(part.part_number)
        setPanelMode('generating')
      }).catch(() => {
        setPanelMode('error')
      })
    }
  }

  function handleRevise() {
    if (!bookData || selectedPartId === null) return
    const s = bookData.state[String(selectedPartId)]
    if (s !== 'script_ready' && s !== 'audio_ready') return
    if (s === 'audio_ready' && !reviseConfirmPending) {
      setReviseConfirmPending(true)
      return
    }
    setReviseConfirmPending(false)
    fetch('http://localhost:8000/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_folder: bookFolder, part_number: selectedPartId }),
    })
      .then(res => { if (!res.ok) throw new Error() })
      .then(() => {
        setGeneratingPartId(selectedPartId)
        setPanelMode('generating')
      })
      .catch(() => setPanelMode('error'))
  }

  function handlePodcast() {
    const { podcastActive } = getButtonStates(bookData, selectedPartId)
    if (!podcastActive || selectedPartId === null) return
    fetch('http://localhost:8000/podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_folder: bookFolder, part_number: selectedPartId }),
    })
      .then(res => { if (!res.ok) throw new Error() })
      .then(() => {
        setAudioGeneratingPartId(selectedPartId)
        setPanelMode('audio_generating')
        setPodcastProgress({ current: 0, total: 0 })
      })
      .catch(() => setPanelMode('audio_error'))
  }

  useEffect(() => {
    if (panelMode !== 'audio_generating' || audioGeneratingPartId === null) return
    const interval = setInterval(() => {
      fetch(`http://localhost:8000/podcast-progress/${bookFolder}/${audioGeneratingPartId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setPodcastProgress(data) })
        .catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [panelMode, audioGeneratingPartId, bookFolder])

  useEffect(() => {
    fetch(`http://localhost:8000/book/${bookFolder}`)
      .then(res => {
        if (!res.ok) throw new Error('not ok')
        return res.json()
      })
      .then(data => setBookData(data))
      .catch(() => setLoadError(true))
  }, [bookFolder])

  useEffect(() => {
    if (!bookData) return
    const interval = setInterval(() => {
      fetch(`http://localhost:8000/book/${bookFolder}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return
          setBookData(prev => ({
            ...prev,
            parts: data.parts,
            state: data.state,
          }))
          if (panelModeRef.current === 'generating' && selectedPartId !== null) {
            const selectedPart = data.parts.find(p => p.part_number === selectedPartId)
            if (selectedPart && !selectedPart.is_generating) {
              const partState = data.state[String(selectedPartId)]
              if (partState === 'script_ready' || partState === 'audio_ready') {
                fetchScript(selectedPartId)
              } else {
                setPanelMode('error')
                setGeneratingPartId(null)
              }
            }
          }
          if (panelModeRef.current === 'audio_generating' && audioGeneratingPartIdRef.current !== null) {
            const audioPartId = audioGeneratingPartIdRef.current
            const partState = data.state[String(audioPartId)]
            if (partState === 'audio_ready') {
              fetchScript(audioPartId)
              setAudioGeneratingPartId(null)
            } else {
              const audioPart = data.parts.find(p => p.part_number === audioPartId)
              if (audioPart && !audioPart.is_audio_generating) {
                setPanelMode('audio_error')
                setAudioGeneratingPartId(null)
              }
            }
          }
        })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [bookFolder, !!bookData, selectedPartId])

  function renderRightPanel() {
    if (selectedPartId === null) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 16, padding: '0 48px',
          textAlign: 'center',
        }}>
          <ScrollText size={32} strokeWidth={1} color="var(--gold-muted)" style={{ marginBottom: 8 }} />
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
            fontSize: 28, color: 'var(--text)', fontWeight: 400, margin: 0,
          }}>
            {bookTitle}
          </h2>
          <p style={{
            fontFamily: "'Crimson Pro', serif", fontSize: 14,
            color: 'var(--text-muted)', margin: 0,
          }}>
            Select a part to generate its script.
          </p>
        </div>
      )
    }

    if (panelMode === 'generating') {
      return (
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[...Array(10)].map((_, i) => (
            <div key={i}>
              <div style={{
                fontFamily: "'Crimson Pro', serif", fontSize: 11,
                color: 'var(--gold)', textTransform: 'uppercase',
                letterSpacing: 1, marginBottom: 6
              }}>
                {i % 2 === 0 ? 'Alex' : 'Morgan'}
              </div>
              <div style={{
                height: 14, borderRadius: 3,
                width: `${60 + (i * 17) % 30}%`,
                background: 'var(--surface-raised)',
                animation: 'blink-pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.08}s`,
              }} />
            </div>
          ))}
        </div>
      )
    }

    if (panelMode === 'script') {
      const { reviseActive, podcastActive } = getButtonStates(bookData, selectedPartId)
      const partIsAudioReady = bookData?.state[String(selectedPartId)] === 'audio_ready'
      const selectedPartTitle = bookData?.parts.find(p => p.part_number === selectedPartId)?.title || ''

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Tab bar — only for audio_ready parts */}
          {partIsAudioReady && (
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              flexShrink: 0,
            }}>
              {['script', 'player'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  style={{
                    padding: '10px 24px',
                    fontFamily: "'Crimson Pro', serif",
                    fontSize: 13,
                    letterSpacing: 0.5,
                    textTransform: 'capitalize',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: rightTab === tab ? 'var(--gold)' : 'var(--text-muted)',
                    borderBottom: rightTab === tab
                      ? '2px solid var(--gold)'
                      : '2px solid transparent',
                  }}
                >
                  {tab === 'script' ? 'Script' : 'Player'}
                </button>
              ))}
            </div>
          )}

          {/* Script view — always mounted, hidden via CSS when player tab active */}
          <div style={{
            display: (!partIsAudioReady || rightTab === 'script') ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '24px 32px', overflowY: 'auto', flex: 1,
              display: 'flex', flexDirection: 'column', gap: 0,
            }}>
              {script && script.map((item, i) => (
                <div key={i} style={{
                  padding: '12px 0',
                  borderTop: i > 0 ? '1px solid rgba(42,63,107,0.3)' : 'none',
                }}>
                  <div style={{
                    fontFamily: "'Crimson Pro', serif", fontSize: 11,
                    color: item.host === 'Alex' ? 'var(--gold)' : 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
                  }}>
                    {item.host}
                  </div>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: 16,
                    color: 'var(--text)', lineHeight: 1.6,
                  }}>
                    {item.line}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              borderTop: '1px solid var(--gold-muted)',
              padding: '12px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--surface)',
              flexShrink: 0,
            }}>
              {reviseConfirmPending && (
                <span style={{
                  fontFamily: "'Crimson Pro', serif",
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  marginRight: 'auto',
                }}>
                  This will delete your existing audio. Click again to confirm.
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                <button
                  onClick={handleRevise}
                  style={{
                    border: '1px solid var(--gold)',
                    color: 'var(--gold)',
                    background: 'transparent',
                    fontFamily: "'Crimson Pro', serif",
                    fontSize: 13,
                    padding: '7px 20px',
                    cursor: reviseActive ? 'pointer' : 'not-allowed',
                    opacity: reviseActive ? 1 : 0.35,
                    letterSpacing: 0.5,
                    transition: 'opacity 0.15s',
                  }}
                >
                  Revise Script
                </button>
                <button
                  onClick={handlePodcast}
                  style={{
                    border: '1px solid var(--gold)',
                    color: 'var(--gold)',
                    background: 'transparent',
                    fontFamily: "'Crimson Pro', serif",
                    fontSize: 13,
                    padding: '7px 20px',
                    cursor: podcastActive ? 'pointer' : 'not-allowed',
                    opacity: podcastActive ? 1 : 0.35,
                    letterSpacing: 0.5,
                    transition: 'opacity 0.15s',
                  }}
                >
                  Make a Podcast
                </button>
                {partIsAudioReady && (
                  <a
                    href={getAudioUrl(bookFolder, selectedPartId, selectedPartTitle)}
                    download={`Part${selectedPartId}_${sanitizeName(selectedPartTitle)}.mp3`}
                    className="footer-download"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      padding: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      textDecoration: 'none',
                    }}
                    title="Download MP3"
                  >
                    <Download size={15} strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Player view — always mounted when audio_ready, hidden via CSS when script tab active */}
          {partIsAudioReady && (
            <div style={{
              display: rightTab === 'player' ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Quill stage — fills top area above controls bar */}
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingBottom: 130,
                overflow: 'hidden',
              }}>
                <svg
                  viewBox="0 0 700 320"
                  style={{ width: '100%', maxWidth: 700, overflow: 'visible' }}
                >
                  <g ref={trailWrapRef} style={{ opacity: 0 }}>
                    <path
                      ref={trailPathRef}
                      fill="none"
                      stroke="#c9a84c"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M 60 220 Q 130 190 200 220 T 340 220 T 480 220 T 620 220"
                    />
                  </g>
                  <g ref={quillPosRef} transform="translate(60 220)">
                    <g ref={quillRotRef} transform="rotate(45)">
                      <path fill="none" stroke="#c9a84c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                            d="M 0 -95 C 22 -75 24 -38 0 -17 C -24 -38 -22 -75 0 -95 Z" />
                      <path fill="none" stroke="#c9a84c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                            d="M -2 -90 C 10 -70 10 -32 0 -18" />
                      <path fill="#c9a84c" d="M -7 -17 L 0 0 L 7 -17 Z" />
                      <circle fill="#0a0e1a" cx="0" cy="-10" r="1.8" />
                    </g>
                  </g>
                </svg>
              </div>

              <audio
                ref={audioRef}
                src={getAudioUrl(bookFolder, selectedPartId, selectedPartTitle)}
                onTimeUpdate={() => {
                  const t = audioRef.current?.currentTime || 0
                  currentTimeRef.current = t
                  setCurrentTime(t)
                }}
                onLoadedMetadata={() => {
                  setDuration(audioRef.current?.duration || 0)
                  const saved = savedPositions.current[selectedPartId]
                  if (saved && audioRef.current) {
                    audioRef.current.currentTime = saved
                    setCurrentTime(saved)
                    currentTimeRef.current = saved
                  }
                }}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {/* Controls bar — pinned to bottom */}
              <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                padding: '20px 32px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>
                {/* Scrubber row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontFamily: "'Crimson Pro', serif",
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    minWidth: 36,
                    letterSpacing: 0.3,
                  }}>
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={currentTime}
                    onChange={e => {
                      const t = parseFloat(e.target.value)
                      if (audioRef.current) audioRef.current.currentTime = t
                      setCurrentTime(t)
                    }}
                    style={{
                      flex: 1,
                      accentColor: 'var(--gold)',
                      cursor: 'pointer',
                      height: 3,
                    }}
                  />
                  <span style={{
                    fontFamily: "'Crimson Pro', serif",
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    minWidth: 36,
                    textAlign: 'right',
                    letterSpacing: 0.3,
                  }}>
                    {formatTime(duration)}
                  </span>
                </div>
                {/* Controls row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 24,
                }}>
                  {/* −10s */}
                  <button
                    onClick={() => {
                      if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10)
                    }}
                    style={iconBtnStyle}
                    title="Rewind 10s"
                  >
                    <RotateCcw size={18} strokeWidth={1.5} color="var(--gold)" />
                  </button>
                  {/* Play / Pause */}
                  <button
                    onClick={() => {
                      if (!audioRef.current) return
                      isPlaying ? audioRef.current.pause() : audioRef.current.play()
                    }}
                    style={{
                      ...iconBtnStyle,
                      width: 44,
                      height: 44,
                      border: '1px solid var(--gold)',
                      borderRadius: '50%',
                    }}
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying
                      ? <Pause size={18} strokeWidth={1.5} color="var(--gold)" />
                      : <Play size={18} strokeWidth={1.5} color="var(--gold)" fill="var(--gold)" />}
                  </button>
                  {/* +10s */}
                  <button
                    onClick={() => {
                      if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 10)
                    }}
                    style={iconBtnStyle}
                    title="Skip 10s"
                  >
                    <RotateCw size={18} strokeWidth={1.5} color="var(--gold)" />
                  </button>
                  {/* Speed selector */}
                  <select
                    value={playbackRate}
                    onChange={e => setPlaybackRate(parseFloat(e.target.value))}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                      fontFamily: "'Crimson Pro', serif",
                      fontSize: 12,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      letterSpacing: 0.3,
                    }}
                  >
                    {[0.75, 1, 1.25, 1.5, 2].map(r => (
                      <option key={r} value={r}>{r}x</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

        </div>
      )
    }

    if (panelMode === 'audio_generating') {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 24, padding: '0 48px',
        }}>
          <div style={{ width: '100%', maxWidth: 320 }}>
            <div style={{
              height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', background: 'var(--gold)',
                width: podcastProgress.total > 0
                  ? `${(podcastProgress.current / podcastProgress.total) * 100}%`
                  : '0%',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
          <p style={{
            fontFamily: "'Crimson Pro', serif", fontSize: 14,
            color: 'var(--text-muted)', margin: 0, textAlign: 'center',
          }}>
            {podcastProgress.total > 0
              ? `Generating line ${podcastProgress.current} of ${podcastProgress.total}`
              : 'Preparing audio…'}
          </p>
        </div>
      )
    }

    if (panelMode === 'audio_error') {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 16, padding: '0 48px',
          textAlign: 'center',
        }}>
          <AlertCircle size={24} color="var(--text-muted)" strokeWidth={1.5} />
          <p style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
            fontSize: 18, color: 'var(--text-muted)', margin: 0,
          }}>
            Audio generation failed.
          </p>
          <p style={{
            fontFamily: "'Crimson Pro', serif", fontSize: 13,
            color: 'var(--text-muted)', margin: 0,
          }}>
            Please try again.
          </p>
          <button
            onClick={() => {
              setPanelMode('script')
              setAudioGeneratingPartId(null)
            }}
            style={{
              border: '1px solid var(--gold)', color: 'var(--gold)',
              background: 'transparent', fontFamily: "'Crimson Pro', serif",
              fontSize: 13, padding: '8px 20px', cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            Back to Script
          </button>
        </div>
      )
    }

    if (panelMode === 'error') {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 16, padding: '0 48px',
          textAlign: 'center',
        }}>
          <AlertCircle size={24} color="var(--text-muted)" strokeWidth={1.5} />
          <p style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
            fontSize: 18, color: 'var(--text-muted)', margin: 0,
          }}>
            Script generation failed.
          </p>
          <p style={{
            fontFamily: "'Crimson Pro', serif", fontSize: 13,
            color: 'var(--text-muted)', margin: 0,
          }}>
            Gemini returned invalid data after two attempts.
          </p>
          <button
            onClick={() => {
              if (selectedPartId === null) return
              fetch('http://localhost:8000/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ book_folder: bookFolder, part_number: selectedPartId }),
              }).then(res => {
                if (!res.ok) throw new Error()
                setGeneratingPartId(selectedPartId)
                setPanelMode('generating')
              }).catch(() => {})
            }}
            style={{
              border: '1px solid var(--gold)', color: 'var(--gold)',
              background: 'transparent', fontFamily: "'Crimson Pro', serif",
              fontSize: 13, padding: '8px 20px', cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div style={s.workspace}>
      {/* ── Left panel — Parts list ── */}
      <aside style={s.leftPanel}>
        <div style={s.panelHeader}>
          <h2 style={s.panelTitle}>Parts</h2>
          <div style={s.panelRule} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 8 }}>
              <AlertCircle size={20} color="var(--text-muted)" strokeWidth={1.5} />
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
                  color: 'var(--text-muted)', fontSize: 14 }}>
                Could not load book data.
              </span>
            </div>
          ) : !bookData ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} style={{
                margin: '8px 16px', height: 58, borderRadius: 4,
                background: 'var(--surface-raised)',
                animation: 'blink-pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }} />
            ))
          ) : (
            bookData.parts.map(part =>
              renderPartCard(part, bookData.state, selectedPartId, generatingPartId, audioGeneratingPartId, handlePartClick, isPlaying)
            )
          )}
        </div>
      </aside>

      {/* ── Divider ── */}
      <div style={s.divider} />

      {/* ── Right panel — Script / content ── */}
      <main style={s.rightPanel}>
        <div style={s.panelHeader}>
          <h2 style={s.panelTitle}>{bookTitle}</h2>
          <div style={s.panelRule} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderRightPanel()}
        </div>
      </main>
    </div>
  )
}

const s = {
  workspace: {
    display:  'flex',
    height:   'calc(100vh - 64px)',
    overflow: 'hidden',
  },
  leftPanel: {
    width:         '33.333%',
    flexShrink:    0,
    display:       'flex',
    flexDirection: 'column',
    background:    'var(--surface)',
    overflow:      'hidden',
  },
  rightPanel: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    background:    'var(--bg)',
    overflow:      'hidden',
  },
  divider: {
    width:      '1px',
    background: 'var(--gold)',
    opacity:    0.35,
    flexShrink: 0,
  },
  panelHeader: {
    padding:       '1.5rem 1.75rem 0',
    flexShrink:    0,
  },
  panelTitle: {
    fontFamily:    "'Cinzel', serif",
    fontWeight:    600,
    fontSize:      '0.85rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color:         'var(--text-muted)',
    margin:        '0 0 0.75rem',
  },
  panelRule: {
    height:     '1px',
    background: 'linear-gradient(to right, var(--gold), transparent)',
    opacity:    0.3,
    marginBottom: '0',
  },
  panelEmpty: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '2rem',
  },
  emptyText: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize:   '1.1rem',
    fontStyle:  'italic',
    color:      'var(--text-muted)',
    opacity:    0.7,
    margin:     0,
    textAlign:  'center',
  },
}

const iconBtnStyle = {
  background:      'transparent',
  border:          'none',
  cursor:          'pointer',
  padding:         6,
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
}
