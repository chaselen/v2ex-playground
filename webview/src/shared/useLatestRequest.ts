import { useCallback, useRef } from 'react'

/** 最新请求句柄 */
interface LatestRequestHandle {
  /** 请求序号 */
  id: number
  /** 是否仍是最新请求 */
  isLatest(): boolean
}

/**
 * 创建只接受最新请求结果的序号工具
 */
export function useLatestRequest() {
  const requestIdRef = useRef(0)

  /**
   * 开始一次新请求
   */
  const startRequest = useCallback((): LatestRequestHandle => {
    const id = requestIdRef.current + 1
    requestIdRef.current = id

    return {
      id,
      isLatest: () => id === requestIdRef.current
    }
  }, [])

  return { startRequest }
}
