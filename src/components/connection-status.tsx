import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Activity } from 'lucide-react'

interface ConnectionStatusProps {
  isGenerating: boolean
  onRetry?: () => void
}

export function ConnectionStatus({ isGenerating, onRetry }: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null)

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine)
    
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (!isGenerating) return

    // 在生成过程中定期检查连接状态，但频率更低
    const heartbeatInterval = setInterval(async () => {
      // 只在窗口可见且正在生成时检查
      if (!document.hidden) {
        try {
          const response = await fetch('/api/heartbeat', {
            method: 'GET',
            cache: 'no-cache'
          })
          if (response.ok) {
            setLastHeartbeat(new Date())
          }
        } catch (error) {
          // 静默处理错误，避免控制台噪音
        }
      }
    }, 60000) // 每60秒检查一次，减少频率

    return () => clearInterval(heartbeatInterval)
  }, [isGenerating])

  if (!isGenerating) return null

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 p-2 bg-gray-50 rounded-md">
      {isOnline ? (
        <Wifi className="h-3 w-3 text-green-500" />
      ) : (
        <WifiOff className="h-3 w-3 text-red-500" />
      )}
      
      <Activity className="h-3 w-3 animate-pulse text-blue-500" />
      
      <span>保持连接中...</span>
      
      {lastHeartbeat && (
        <span className="text-gray-400">
          最后心跳: {lastHeartbeat.toLocaleTimeString()}
        </span>
      )}
      
      {!isOnline && onRetry && (
        <button
          onClick={onRetry}
          className="text-blue-500 hover:text-blue-700 underline ml-2"
        >
          重试
        </button>
      )}
    </div>
  )
}
