import type { Clock } from '../../ports/system'

/** Real wall-clock. Used everywhere except tests. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }

  nowIso(): string {
    return new Date().toISOString()
  }
}
