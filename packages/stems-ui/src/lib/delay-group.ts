/**
 * Shared hover delays for a group of hint popups (Base UI's `FloatingDelayGroup`, used by
 * `Tooltip.Provider`).
 *
 * While one member is open, or for `timeout` ms after it closed, the group is "active": other
 * members open with no delay, and when one opens the previously open member closes right away
 * (reason `'none'`). Both are then in the "instant phase" so they can skip their enter and exit
 * animations (`data-instant="delay"`).
 */

export interface DelayGroupOptions {
  /** Hover-open delay for members whose trigger doesn't set one. */
  delay?: number
  /** Hover-close delay for members whose trigger doesn't set one. */
  closeDelay?: number
  /**
   * How long after the last member closed the next one still opens instantly, in ms.
   * @default 400
   */
  timeout?: number
}

export interface DelayGroupMember {
  /** Whether the member is open. */
  isOpen(): boolean
  /** Closes the member because another member opened. */
  closeForSibling(): void
  /** Marks the member as in (or out of) the instant phase. */
  setInstantPhase(instant: boolean): void
}

export interface DelayGroup {
  /** Whether a member is open or closed less than `timeout` ago. */
  readonly active: boolean
  /** The hover-open delay for a member: `0` while active, else the trigger's, the group's, or `fallback`. */
  openDelay(triggerDelay: number | undefined, fallback: number): number
  /** The hover-close delay: the trigger's, else the group's, else `fallback`. */
  closeDelay(triggerCloseDelay: number | undefined, fallback: number): number
  /**
   * Call when `member` opened. Closes the previously open member. Returns whether `member` opened
   * in the instant phase (another member was open or closed recently).
   */
  notifyOpen(member: DelayGroupMember): boolean
  /** Call when `member` closed. Starts the `timeout` after which the group resets. */
  notifyClose(member: DelayGroupMember): void
  /** Call when `member` unmounts. */
  remove(member: DelayGroupMember): void
}

export function createDelayGroup(getOptions: () => DelayGroupOptions): DelayGroup {
  let current: DelayGroupMember | null = null
  let timer = 0

  function clearTimer() {
    clearTimeout(timer)
    timer = 0
  }

  return {
    get active() {
      return current !== null
    },
    openDelay(triggerDelay, fallback) {
      if (current !== null) return 0
      return triggerDelay ?? getOptions().delay ?? fallback
    },
    closeDelay(triggerCloseDelay, fallback) {
      return triggerCloseDelay ?? getOptions().closeDelay ?? fallback
    },
    notifyOpen(member) {
      clearTimer()
      let previous = current
      current = member
      if (previous === null || previous === member) return false
      previous.setInstantPhase(true)
      previous.closeForSibling()
      return true
    },
    notifyClose(member) {
      if (current !== member) return
      clearTimer()
      let timeout = getOptions().timeout ?? 400
      if (timeout <= 0) {
        current = null
        return
      }
      timer = window.setTimeout(() => {
        timer = 0
        if (current === member && !member.isOpen()) current = null
      }, timeout)
    },
    remove(member) {
      if (current !== member) return
      current = null
      clearTimer()
    },
  }
}
