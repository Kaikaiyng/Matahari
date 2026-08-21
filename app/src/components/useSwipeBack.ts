import { useCallback, useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'

const SWIPE_IGNORED_TARGETS = [
  'input',
  'textarea',
  'select',
  '[data-prevent-swipe="true"]',
  '[data-horizontal-scroll="true"]',
  '[role="dialog"]',
  '.overflow-x-auto',
  '.overflow-x-scroll',
].join(', ')

type GestureLock = 'horizontal' | 'vertical' | 'locked' | null

export function useSwipeBack(onBack: () => void, active = true) {
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const surfaceWidthRef = useRef(390)
  const lockRef = useRef<GestureLock>(null)
  const exitTimerRef = useRef<number | null>(null)
  const exitingRef = useRef(false)
  const onBackRef = useRef(onBack)

  useEffect(() => {
    onBackRef.current = onBack
  }, [onBack])

  useEffect(() => {
    if (active) {
      exitingRef.current = false
      setIsExiting(false)
      setDragOffset(0)
      return
    }

    resetGesture()
    exitingRef.current = false
    setIsExiting(false)
    setDragOffset(0)
  }, [active])

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
  }, [])

  const resetGesture = () => {
    startXRef.current = null
    startYRef.current = null
    lockRef.current = null
    setIsDragging(false)
  }

  const completeBack = useCallback(() => {
    if (!active || exitingRef.current) return

    exitingRef.current = true
    setIsExiting(true)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      onBackRef.current()
      return
    }

    setDragOffset(surfaceWidthRef.current)
    exitTimerRef.current = window.setTimeout(() => onBackRef.current(), 220)
  }, [active])

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation()
    if (!active || isExiting) return

    const touch = event.touches[0]
    if (!touch) return

    const target = event.target as HTMLElement | null
    const ignoredTarget = target?.closest(SWIPE_IGNORED_TARGETS)
    if (ignoredTarget && ignoredTarget !== event.currentTarget) {
      lockRef.current = 'locked'
      return
    }

    startXRef.current = touch.clientX
    startYRef.current = touch.clientY
    startTimeRef.current = Date.now()
    surfaceWidthRef.current = event.currentTarget.clientWidth || window.innerWidth || 390
    lockRef.current = null
    setIsDragging(false)
    setDragOffset(0)
  }

  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation()
    if (isExiting || lockRef.current === 'locked' || startXRef.current === null || startYRef.current === null) return

    const touch = event.touches[0]
    if (!touch) return
    const deltaX = touch.clientX - startXRef.current
    const deltaY = touch.clientY - startYRef.current

    if (lockRef.current === null) {
      if (deltaX > 8 && deltaX > Math.abs(deltaY) * 1.1) lockRef.current = 'horizontal'
      else if (deltaX < -8 || Math.abs(deltaY) > 8) lockRef.current = 'vertical'
    }

    if (lockRef.current === 'horizontal') {
      setIsDragging(true)
      setDragOffset(Math.max(0, deltaX))
    }
  }

  const finishGesture = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation()
    const startX = startXRef.current
    const touch = event.changedTouches[0]
    const lock = lockRef.current
    const elapsed = Date.now() - startTimeRef.current
    resetGesture()

    if (isExiting || lock !== 'horizontal' || startX === null || !touch) {
      setDragOffset(0)
      return
    }

    const deltaX = touch.clientX - startX
    const isFlick = elapsed < 250 && deltaX > 45
    if (deltaX > surfaceWidthRef.current * 0.3 || isFlick) {
      completeBack()
      return
    }

    setDragOffset(0)
  }

  const cancelGesture = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation()
    resetGesture()
    if (!isExiting) setDragOffset(0)
  }

  const surfaceStyle: CSSProperties = {
    transform: dragOffset > 0 ? `translate3d(${dragOffset}px, 0, 0)` : undefined,
    transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)',
    animation: isDragging || dragOffset > 0 || isExiting ? 'none' : undefined,
    willChange: isDragging || isExiting ? 'transform' : 'auto',
  }

  return {
    isExiting,
    requestBack: completeBack,
    surfaceStyle,
    gestureHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd: finishGesture,
      onTouchCancel: cancelGesture,
    },
  }
}
