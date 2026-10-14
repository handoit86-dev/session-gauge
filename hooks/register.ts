// session-gauge — 세션 컨텍스트·사용 한도 상태줄 + 임계치 알림 (2026-10-14)
// 기준(형 요청으로 Claude 제안값, 써보고 조정):
//   컨텍스트 50% : "작업 끝나면 인계서 갱신하고 갈아"
//   컨텍스트 70% : "지금 인계서 쓰고 갈아" (자동 압축 전에 인계서 쓸 여유)
//   5시간/7일 한도 80%, 95% : 한도 경고
// 각 기준은 넘을 때 한 번만 알림. 압축·/clear 로 10%p 이상 내려가면 다시 무장.
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

const CTX_STEPS = [
  { at: 50, ms: 15000, say: (p: number) => `컨텍스트 ${p}% — 지금 작업 끝나면 인계서 갱신하고 새 세션 추천` },
  { at: 70, ms: 30000, say: (p: number) => `컨텍스트 ${p}% — 지금 인계서 쓰고 새 세션으로 가 (자동 압축 전에)` },
]
const LIMIT_STEPS = [80, 95]
const REARM_GAP = 10

const LIMIT_NAME: Record<string, string> = {
  five_hour: '5시간',
  seven_day: '7일',
  spend_limit: '지출한도',
}

// 이미 알린 기준: 'ctx:50', 'five_hour:80' 같은 키
const warned = new Set<string>()

function fmtTokens(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
}

function ctxPercent(c: SessionContextUsage): number | undefined {
  if (c.percent !== undefined) return Math.round(c.percent)
  if (c.tokens !== undefined && c.window > 0) return Math.round((c.tokens / c.window) * 100)
  return undefined
}

function crossed(key: string, value: number, at: number): boolean {
  if (value >= at) {
    if (warned.has(key)) return false
    warned.add(key)
    return true
  }
  if (value < at - REARM_GAP) warned.delete(key)
  return false
}

function apply($: EngineInterface, context: SessionContextUsage, rateLimits: SessionRateLimit[]): void {
  const p = ctxPercent(context)
  const parts: string[] = []

  if (p !== undefined) {
    const tok = context.tokens !== undefined ? ` (${fmtTokens(context.tokens)}/${fmtTokens(context.window)})` : ''
    parts.push(`컨텍스트 ${p}%${tok}`)
    for (const s of CTX_STEPS) {
      if (crossed(`ctx:${s.at}`, p, s.at)) $.ui.toast(s.say(p), { timeoutMs: s.ms })
    }
  }

  for (const r of rateLimits) {
    const name = LIMIT_NAME[r.kind] ?? r.kind
    const used = Math.round(r.percentUsed)
    parts.push(`${name} ${used}%`)
    for (const at of LIMIT_STEPS) {
      if (crossed(`${r.kind}:${at}`, used, at)) {
        $.ui.toast(`${name} 사용 한도 ${used}% 도달`, { timeoutMs: 20000 })
      }
    }
  }

  if (p !== undefined && p >= 70) parts.push('교체 권장')
  $.ui.status(parts.length > 0 ? parts.join(' · ') : undefined)
}

export const register: Register = on => {
  warned.clear()

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    try {
      const u = await $.session.usage()
      apply($, u.context, u.rateLimits)
    } catch {
      // 첫 응답 전이라 수치가 없을 수 있음 — 다음 measure 에서 채움
    }
    return r
  })

  on('session.measure', ($, e, next) => {
    apply($, e.context, e.rateLimits)
    return next(e)
  })
}
