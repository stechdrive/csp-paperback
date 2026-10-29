import { useAutomaticUpdateCheck } from '../hooks/useAutomaticUpdateCheck'
import { UpdateCheckDialog } from './UpdateCheckPanel'

/** Quick export mounts this only after its batch has finished. */
export function AutomaticUpdateCheck({ busy }: { busy: boolean }) {
  const { notification, dismiss } = useAutomaticUpdateCheck(busy)
  return notification ? <UpdateCheckDialog initialInfo={notification} onClose={dismiss} /> : null
}
