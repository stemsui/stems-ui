import { expect } from 'remix/assert'
import { describe, it } from 'remix/test'

import { createDelayGroup } from './delay-group.ts'
import type { DelayGroupMember } from './delay-group.ts'

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function member(log: string[], name: string) {
  let state = { open: false, instant: false }
  let value: DelayGroupMember = {
    isOpen: () => state.open,
    closeForSibling() {
      log.push(`${name}:close`)
      state.open = false
    },
    setInstantPhase(instant) {
      log.push(`${name}:instant:${instant}`)
      state.instant = instant
    },
  }
  return { value, state }
}

describe('delay-group', () => {
  it('resolves delays from the trigger, then the group, then the fallback', () => {
    let group = createDelayGroup(() => ({ delay: 100, closeDelay: 50 }))
    expect(group.openDelay(undefined, 600)).toBe(100)
    expect(group.openDelay(20, 600)).toBe(20)
    expect(group.closeDelay(undefined, 0)).toBe(50)
    expect(group.closeDelay(5, 0)).toBe(5)
    expect(createDelayGroup(() => ({})).openDelay(undefined, 600)).toBe(600)
  })

  it('opens instantly while a member is open and closes the previous member', () => {
    let log: string[] = []
    let group = createDelayGroup(() => ({ delay: 100 }))
    let a = member(log, 'a')
    let b = member(log, 'b')

    a.state.open = true
    expect(group.notifyOpen(a.value)).toBe(false)
    expect(group.active).toBe(true)
    expect(group.openDelay(undefined, 600)).toBe(0)

    b.state.open = true
    expect(group.notifyOpen(b.value)).toBe(true)
    expect(log).toEqual(['a:instant:true', 'a:close'])
    expect(a.state.open).toBe(false)
  })

  it('stays active for `timeout` after the last member closed', async () => {
    let group = createDelayGroup(() => ({ timeout: 30 }))
    let a = member([], 'a')
    a.state.open = true
    group.notifyOpen(a.value)
    a.state.open = false
    group.notifyClose(a.value)
    expect(group.active).toBe(true)
    await sleep(60)
    expect(group.active).toBe(false)

    // Reopening the same member within the timeout isn't instant for itself.
    a.state.open = true
    expect(group.notifyOpen(a.value)).toBe(false)
    a.state.open = false
    group.notifyClose(a.value)
    a.state.open = true
    expect(group.notifyOpen(a.value)).toBe(false)
  })

  it('resets right away with timeout 0 and when the member is removed', () => {
    let group = createDelayGroup(() => ({ timeout: 0 }))
    let a = member([], 'a')
    group.notifyOpen(a.value)
    group.notifyClose(a.value)
    expect(group.active).toBe(false)

    group.notifyOpen(a.value)
    group.remove(a.value)
    expect(group.active).toBe(false)
  })
})
