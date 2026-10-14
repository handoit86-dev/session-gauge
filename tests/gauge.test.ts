import { test, expect } from 'claude-code/testing'

const ctx = (percent: number) => ({ window: 200000, tokens: percent * 2000, percent })

test('컨텍스트 50/70% 는 넘을 때 한 번씩만 알리고, 내려갔다 다시 넘으면 또 알림', async ($, on) => {
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
  on('ui.status', ($, e) => (statuses.push(e.text), { value: undefined }))
  on('session.measure', ($, e) => ({ changed: e.changed }))

  const m = (p: number) => $.session.measure({ context: ctx(p), rateLimits: [], changed: ['context'] })

  await m(30)
  expect(toasts.length).toBe(0)
  expect(statuses.at(-1)).toBe('컨텍스트 30% (60k/200k)')

  await m(52)
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('52%')

  await m(60)
  expect(toasts.length).toBe(1)

  await m(71)
  expect(toasts.length).toBe(2)
  expect(statuses.at(-1)).toContain('교체 권장')

  await m(20) // 압축·/clear 뒤
  await m(51)
  expect(toasts.length).toBe(3)
})

test('5시간 한도 80% 알림, 상태줄에 한도 표시', async ($, on) => {
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
  on('ui.status', ($, e) => (statuses.push(e.text), { value: undefined }))
  on('session.measure', ($, e) => ({ changed: e.changed }))

  await $.session.measure({
    context: ctx(10),
    rateLimits: [{ kind: 'five_hour', percentUsed: 81.5 }, { kind: 'seven_day', percentUsed: 12 }],
    changed: ['context', 'rateLimits'],
  })
  expect(toasts).toEqual(['5시간 사용 한도 82% 도달'])
  expect(statuses.at(-1)).toBe('컨텍스트 10% (20k/200k) · 5시간 82% · 7일 12%')
})
