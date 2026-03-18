import { useEffect, useRef, useState } from 'react'
import { createGame } from './engine'

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [locked, setLocked] = useState(false)
  const [stamina, setStamina] = useState(1)
  const [lives, setLives] = useState(3)

  useEffect(() => {
    if (!canvasRef.current) return
    return createGame(canvasRef.current, setLocked, setStamina, setLives)
  }, [])

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {locked && (
        <div style={{ position: 'absolute', inset: 0, background: '#000', zIndex: 10 }} />
      )}
      <div style={{
        position: 'absolute', top: '16px', left: '16px',
        fontSize: '28px', userSelect: 'none',
      }}>
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} style={{ color: i < lives ? '#ff4444' : '#444', marginRight: '4px' }}>
            ♥
          </span>
        ))}
      </div>
      {lives <= 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
        }}>
          <span style={{ fontSize: '48px', color: '#ff4444', fontWeight: 'bold' }}>
            GAME OVER
          </span>
          <span style={{ fontSize: '16px', color: '#999', marginTop: '16px' }}>
            새로고침하여 다시 시작
          </span>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
        width: '200px', height: '8px', borderRadius: '4px',
        background: 'rgba(0,0,0,0.5)',
      }}>
        <div style={{
          width: `${stamina * 100}%`, height: '100%', borderRadius: '4px',
          background: stamina > 0.3 ? '#4caf50' : '#f44336',
          transition: 'background 0.2s',
        }} />
      </div>
      {!locked && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            padding: '12px 24px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.7)', color: '#ccc', fontSize: '14px',
          }}>
            클릭하면 마우스로 회전 · WASD 이동 · Shift 달리기 · 방향키 카메라 · Space 레이저
          </span>
        </div>
      )}
    </div>
  )
}
