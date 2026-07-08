import { useState } from 'react'
import { saveSampleTemplate } from '../platform/sample-template'

interface SampleTemplateDownloadButtonProps {
  className?: string
  statusClassName?: string
  errorClassName?: string
  label?: string
}

type DownloadStatus = 'idle' | 'saving' | 'done' | 'error'

export function SampleTemplateDownloadButton({
  className,
  statusClassName,
  errorClassName,
  label = 'サンプルテンプレートをダウンロード',
}: SampleTemplateDownloadButtonProps) {
  const [status, setStatus] = useState<DownloadStatus>('idle')

  const handleClick = async () => {
    setStatus('saving')
    try {
      await saveSampleTemplate()
      setStatus('done')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('idle')
        return
      }
      setStatus('error')
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => void handleClick()}
        disabled={status === 'saving'}
      >
        {status === 'saving' ? '保存中…' : label}
      </button>
      {status === 'done' && (
        <div className={statusClassName}>ダウンロードを開始しました</div>
      )}
      {status === 'error' && (
        <div className={errorClassName}>テンプレートを保存できませんでした</div>
      )}
    </>
  )
}
