// frontend/src/hooks/useLiveScoring.js
/**
 * Hook WebSocket para updates ao vivo de scoring.
 *
 * Conecta ao endpoint /ws/stage-day/{stageDayId} e chama onUpdate()
 * toda vez que o backend broadcasteia um evento "scoring_updated".
 *
 * Reconecta automaticamente com backoff exponencial (até 30s).
 * Desconecta limpo quando o componente desmonta ou stageDayId muda.
 *
 * @param {number|null} stageDayId  - ID do StageDay a observar (null = desconectado)
 * @param {() => void}  onUpdate    - Callback chamado ao receber scoring_updated
 * @returns {{ connected: boolean }} - Estado da conexão para mostrar indicador visual
 */
import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'

const WS_BASE = API_BASE_URL.replace(/^http/, 'ws')

export function useLiveScoring(stageDayId, onUpdate) {
  const [connected, setConnected] = useState(false)
  const wsRef    = useRef(null)
  const retryRef = useRef(null)
  const retryDelay = useRef(1000)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!stageDayId) return

    function connect() {
      if (!mountedRef.current) return

      const url = `${WS_BASE}/ws/stage-day/${stageDayId}`
      const ws  = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return }
        setConnected(true)
        retryDelay.current = 1000  // reset backoff
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.type === 'scoring_updated') {
            onUpdate?.()
          }
          // "ping" é ignorado — apenas keepalive
        } catch {}
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setConnected(false)
        // Reconecta com backoff (max 30s)
        const delay = retryDelay.current
        retryDelay.current = Math.min(delay * 2, 30_000)
        retryRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()  // onclose vai cuidar do retry
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(retryRef.current)
      wsRef.current?.close()
      setConnected(false)
    }
  }, [stageDayId])  // eslint-disable-line react-hooks/exhaustive-deps

  return { connected }
}
