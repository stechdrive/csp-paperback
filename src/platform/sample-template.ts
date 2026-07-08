import { downloadBlob } from '../utils/zip-builder'
import { createAbortError, isDesktopRuntime } from './runtime'

export const SAMPLE_TEMPLATE_FILE_NAME = 'csp-paperback-sample-template.clip'

const SAMPLE_TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/${SAMPLE_TEMPLATE_FILE_NAME}`

export async function saveSampleTemplate(): Promise<void> {
  const response = await fetch(SAMPLE_TEMPLATE_URL)
  if (!response.ok) {
    throw new Error(`Failed to load sample template: ${response.status} ${response.statusText}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())

  if (isDesktopRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({
      title: 'サンプル作画テンプレートを保存',
      defaultPath: SAMPLE_TEMPLATE_FILE_NAME,
      filters: [{ name: 'CLIP STUDIO PAINT file', extensions: ['clip'] }],
    })
    if (path === null) throw createAbortError()

    await writeFile(path, bytes)
    return
  }

  downloadBlob(new Blob([bytes], { type: 'application/octet-stream' }), SAMPLE_TEMPLATE_FILE_NAME)
}
