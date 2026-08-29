import type { LecApi } from '../../../shared/ipc'

declare global {
  interface Window {
    lec: LecApi
  }
}

export {}
