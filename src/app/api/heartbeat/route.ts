import { NextRequest, NextResponse } from 'next/server'

// 心跳接口，用于保活连接
export async function POST(request: NextRequest) {
  try {
    // 简化处理，避免解析可能失败的JSON
    const body = await request.text()
    let timestamp: number | undefined
    
    try {
      const data = body ? JSON.parse(body) : {}
      timestamp = data.timestamp
    } catch {
      // 忽略JSON解析错误，继续处理
      timestamp = undefined
    }
    
    return NextResponse.json({ 
      status: 'alive',
      timestamp: Date.now(),
      received: timestamp || 0,
      message: 'Connection is alive'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Heartbeat POST error:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Heartbeat failed',
        timestamp: Date.now()
      },
      { status: 200 } // 返回200避免客户端报错
    )
  }
}

export async function GET() {
  try {
    return NextResponse.json({ 
      status: 'alive',
      timestamp: Date.now(),
      message: 'Heartbeat endpoint is working'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Heartbeat GET error:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Heartbeat failed',
        timestamp: Date.now()
      },
      { status: 200 }
    )
  }
}
