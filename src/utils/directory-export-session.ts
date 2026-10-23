import type { DirectoryExportMode } from '../types/output'

export interface ExportConflict {
  directory: string
  mode: DirectoryExportMode
  overwriteCount: number
  newCount: number
  allowApplyToRemaining: boolean
}
export interface ExportConflictAnswer {
  action: 'overwrite' | 'rename' | 'cancel'
  applyToRemaining?: boolean
}
export type ConfirmExportConflict = (conflict: ExportConflict) => Promise<ExportConflictAnswer>

/** Only lives for one invocation. No overwrite permission is persisted. */
export class DirectoryExportSession {
  readonly files = new Map<string, Set<string>>()
  readonly roots = new Set<string>()
  private remembered?: ExportConflictAnswer
  private readonly confirm: ConfirmExportConflict
  readonly batch: boolean

  constructor(confirm: ConfirmExportConflict = async () => ({ action: 'rename' }), batch = false) {
    this.confirm = confirm
    this.batch = batch
  }

  async decide(conflict: Omit<ExportConflict, 'allowApplyToRemaining'>): Promise<ExportConflictAnswer> {
    if (this.remembered) return this.remembered
    const answer = await this.confirm({ ...conflict, allowApplyToRemaining: this.batch })
    if (this.batch && answer.applyToRemaining && answer.action !== 'cancel') this.remembered = answer
    return answer
  }
}
