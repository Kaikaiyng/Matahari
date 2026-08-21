import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSwipeBack } from './useSwipeBack'

function SwipeSurface({ onBack }: { onBack: () => void }) {
  const { gestureHandlers, surfaceStyle } = useSwipeBack(onBack)

  return (
    <main data-testid="surface" style={surfaceStyle} {...gestureHandlers}>
      <div data-testid="categories" data-horizontal-scroll="true">Categories</div>
      <div data-testid="content">Content</div>
    </main>
  )
}

describe('useSwipeBack', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not navigate from the horizontal category scroller or a left swipe', () => {
    vi.useFakeTimers()
    const onBack = vi.fn()
    render(<SwipeSurface onBack={onBack} />)

    const categories = screen.getByTestId('categories')
    fireEvent.touchStart(categories, { touches: [{ clientX: 60, clientY: 20 }] })
    fireEvent.touchMove(categories, { touches: [{ clientX: 180, clientY: 20 }] })
    fireEvent.touchEnd(categories, { changedTouches: [{ clientX: 180, clientY: 20 }] })

    const content = screen.getByTestId('content')
    fireEvent.touchStart(content, { touches: [{ clientX: 220, clientY: 20 }] })
    fireEvent.touchMove(content, { touches: [{ clientX: 80, clientY: 20 }] })
    fireEvent.touchEnd(content, { changedTouches: [{ clientX: 80, clientY: 20 }] })
    act(() => vi.advanceTimersByTime(300))

    expect(onBack).not.toHaveBeenCalled()
  })

  it('completes a fast rightward swipe once', () => {
    vi.useFakeTimers()
    const onBack = vi.fn()
    render(<SwipeSurface onBack={onBack} />)

    const content = screen.getByTestId('content')
    fireEvent.touchStart(content, { touches: [{ clientX: 40, clientY: 20 }] })
    fireEvent.touchMove(content, { touches: [{ clientX: 120, clientY: 22 }] })
    fireEvent.touchEnd(content, { changedTouches: [{ clientX: 120, clientY: 22 }] })

    expect(onBack).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(220))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('rebounds after a short slow rightward drag', () => {
    vi.useFakeTimers()
    const onBack = vi.fn()
    render(<SwipeSurface onBack={onBack} />)

    const surface = screen.getByTestId('surface')
    const content = screen.getByTestId('content')
    fireEvent.touchStart(content, { touches: [{ clientX: 40, clientY: 20 }] })
    act(() => vi.advanceTimersByTime(300))
    fireEvent.touchMove(content, { touches: [{ clientX: 70, clientY: 20 }] })
    expect(surface).toHaveStyle({ transform: 'translate3d(30px, 0, 0)' })
    expect(surface).toHaveStyle({ animation: 'none' })
    fireEvent.touchEnd(content, { changedTouches: [{ clientX: 70, clientY: 20 }] })

    expect(surface.style.transform).toBe('')
    act(() => vi.advanceTimersByTime(300))
    expect(onBack).not.toHaveBeenCalled()
  })
})
