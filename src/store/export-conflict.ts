import { create } from 'zustand'
import type { ExportConflict, ExportConflictAnswer, ConfirmExportConflict } from '../utils/directory-export-session'

export const useExportConflict = create<{ pending: { conflict: ExportConflict; answer: (answer: ExportConflictAnswer) => void } | null }>(() => ({ pending: null }))

export const confirmExportConflict: ConfirmExportConflict = conflict => new Promise(resolve => {
  if (useExportConflict.getState().pending) throw new Error('書き出しの確認がすでに開いています')
  useExportConflict.setState({ pending: { conflict, answer: answer => {
    useExportConflict.setState({ pending: null })
    resolve(answer)
  } } })
})
