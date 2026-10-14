import { useEffect } from 'react'
import { useAppStore } from '../store'

/**
 * Undo/Redo のキーボードショートカットを登録し、状態を返す。
 * Ctrl+Z: Undo / Ctrl+Shift+Z: Redo
 *
 * App のルートコンポーネントでマウントする。
 */
export function useUndoRedo() {
  const undo = useAppStore(s => s.undo)
  const redo = useAppStore(s => s.redo)
  const canUndo = useAppStore(s => s.canUndo)
  const canRedo = useAppStore(s => s.canRedo)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.defaultPrevented || e.isComposing) return
      if (document.querySelector('dialog[open]')) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], dialog')) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return { canUndo, canRedo, undo, redo }
}
