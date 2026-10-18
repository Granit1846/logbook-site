import { useRef, type TouchEvent } from 'react';

interface SwipeOptions {
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}

const COMMIT_DISTANCE = 60; // px the finger must travel to switch
const EDGE_GUARD = 24; // px from the screen edge left to the system back gesture
const SKIP_TARGETS = 'input, textarea, select, [contenteditable="true"], [data-no-swipe]';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Horizontal swipe between neighbouring views: the content follows the finger, a long enough swipe
 * switches and the new content slides in from that side. Vertical scrolling stays with the browser
 * (touch-action: pan-y on the element). Animations use the Web Animations API, so the content is not
 * re-mounted and form state survives.
 */
export function useHorizontalSwipe<T extends HTMLElement>({ onPrev, onNext, canPrev = true, canNext = true }: SwipeOptions) {
  const ref = useRef<T>(null);
  const gesture = useRef<{ x: number; y: number; dx: number; axis: 'x' | 'y' | null } | null>(null);

  const setOffset = (px: number) => {
    if (ref.current) ref.current.style.transform = px ? `translateX(${px}px)` : '';
  };

  const settle = (fromPx: number) => {
    const el = ref.current;
    if (!el) return;
    setOffset(0);
    if (fromPx && !reducedMotion()) {
      el.animate([{ transform: `translateX(${fromPx}px)` }, { transform: 'translateX(0)' }], { duration: 180, easing: 'ease-out' });
    }
  };

  const enterFrom = (side: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    setOffset(0);
    if (!reducedMotion()) {
      el.animate(
        [{ transform: `translateX(${side * 30}%)`, opacity: 0.3 }, { transform: 'translateX(0)', opacity: 1 }],
        { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
  };

  const onTouchStart = (event: TouchEvent<T>) => {
    const touch = event.touches[0];
    const target = event.target as Element | null;
    if (event.touches.length !== 1 || target?.closest(SKIP_TARGETS)
      || touch.clientX < EDGE_GUARD || touch.clientX > window.innerWidth - EDGE_GUARD) {
      gesture.current = null;
      return;
    }
    gesture.current = { x: touch.clientX, y: touch.clientY, dx: 0, axis: null };
  };

  const onTouchMove = (event: TouchEvent<T>) => {
    const state = gesture.current;
    if (!state) return;
    const touch = event.touches[0];
    const dx = touch.clientX - state.x;
    const dy = touch.clientY - state.y;
    if (!state.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      state.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
    }
    if (state.axis !== 'x') return;
    state.dx = dx;
    const allowed = dx > 0 ? canPrev : canNext;
    setOffset(dx * (allowed ? 0.55 : 0.15)); // resistance when there is nothing on that side
  };

  const onTouchEnd = () => {
    const state = gesture.current;
    gesture.current = null;
    if (!state || state.axis !== 'x') return;
    const offset = state.dx * ((state.dx > 0 ? canPrev : canNext) ? 0.55 : 0.15);
    if (state.dx <= -COMMIT_DISTANCE && canNext) {
      onNext();
      enterFrom(1);
    } else if (state.dx >= COMMIT_DISTANCE && canPrev) {
      onPrev();
      enterFrom(-1);
    } else {
      settle(offset);
    }
  };

  // An interrupted touch (system gesture, incoming call) never switches; the content just returns.
  const onTouchCancel = () => {
    const state = gesture.current;
    gesture.current = null;
    if (state?.axis === 'x') settle(state.dx * ((state.dx > 0 ? canPrev : canNext) ? 0.55 : 0.15));
  };

  return {
    ref,
    swipeProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
      style: { touchAction: 'pan-y' as const },
    },
  };
}
