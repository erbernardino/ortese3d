import { useReducer, useCallback } from 'react'

const MAX_HISTORY = 50

function historyReducer(state, action) {
  switch (action.type) {
    case 'PUSH': {
      const past = [...state.past, state.present].slice(-MAX_HISTORY)
      return { past, present: action.snapshot, future: [] }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const past = state.past.slice(0, -1)
      const present = state.past[state.past.length - 1]
      return { past, present, future: [state.present, ...state.future] }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const [present, ...future] = state.future
      return { past: [...state.past, state.present], present, future }
    }
    default:
      return state
  }
}

export function useModelHistory(initial = null) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
  })

  const push = useCallback(snapshot => dispatch({ type: 'PUSH', snapshot }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  return {
    current: state.present,
    push,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
