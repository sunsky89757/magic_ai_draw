// 连接管理器 - 处理长时间任务的保活机制
export class ConnectionManager {
  private keepAliveInterval: NodeJS.Timeout | null = null
  private abortController: AbortController | null = null
  
  constructor() {}

  // 开始保活机制
  startKeepAlive(onKeepAlive?: () => void) {
    this.stopKeepAlive() // 先停止之前的保活
    
    // 减少心跳频率到45秒，并且只在必要时发送
    this.keepAliveInterval = setInterval(() => {
      if (onKeepAlive) {
        onKeepAlive()
      }
      // 只在浏览器窗口可见时发送心跳，减少服务器负担
      if (!document.hidden) {
        this.sendHeartbeat().catch(() => {
          // 静默处理心跳失败，避免控制台报错
        })
      }
    }, 45000) // 增加到45秒
  }

  // 停止保活机制
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  // 发送心跳请求
  private async sendHeartbeat() {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
      
      await fetch('/api/heartbeat', {
        method: 'GET', // 改为GET请求，更简单
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store'
        }
      })
      
      clearTimeout(timeoutId)
    } catch (error) {
      // 完全静默处理，避免控制台噪音
    }
  }

  // 带重试机制的请求
  async fetchWithRetry(
    url: string, 
    options: RequestInit, 
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<Response> {
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 创建新的AbortController
        this.abortController = new AbortController()
        const signal = this.abortController.signal

        const response = await fetch(url, {
          ...options,
          signal,
          // 设置较长的超时时间
          ...(options.headers && {
            headers: {
              ...options.headers,
              'Keep-Alive': 'timeout=300',
              'Connection': 'keep-alive'
            }
          })
        })

        if (response.ok) {
          return response
        }

        // 如果是超时错误，进行重试
        if (response.status === 408 || response.status === 504) {
          throw new Error(`Request timeout (${response.status})`)
        }

        return response
      } catch (error) {
        lastError = error as Error
        
        // 如果是取消的请求，不重试
        if (lastError.name === 'AbortError') {
          throw lastError
        }

        // 最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          throw lastError
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
      }
    }

    throw lastError!
  }

  // 长时间流式请求处理
  async handleLongStreamRequest(
    url: string,
    options: RequestInit,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ) {
    this.startKeepAlive(() => {
      console.log('Keeping connection alive...')
    })

    try {
      const response = await this.fetchWithRetry(url, options)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response reader')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            onComplete()
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine) {
              onChunk(trimmedLine)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      onError(error as Error)
    } finally {
      this.stopKeepAlive()
    }
  }
}

// 导出单例实例
export const connectionManager = new ConnectionManager()
