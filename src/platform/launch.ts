import { isDesktopRuntime } from './runtime'

const QUICK_EXPORT_EXTENSIONS = new Set(['psd', 'xdts'])

function ext(path: string): string {
  return path.toLowerCase().split('.').pop() ?? ''
}

export function filterQuickExportLaunchPaths(args: string[]): string[] {
  return args.filter(arg => QUICK_EXPORT_EXTENSIONS.has(ext(arg)))
}

export async function getQuickExportLaunchPaths(): Promise<string[]> {
  if (!isDesktopRuntime()) return []

  const { invoke } = await import('@tauri-apps/api/core')
  const args = await invoke<string[]>('get_launch_args')
  return filterQuickExportLaunchPaths(args)
}
