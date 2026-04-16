import { useEffect, useRef } from 'react'

export function usePolling(fn, interval = 5000) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    ref.current()
    const id = setInterval(() => ref.current(), interval)
    return () => clearInterval(id)
  }, [interval])
}
