# session-gauge

세션의 컨텍스트 사용률·토큰과 5시간/7일 사용 한도를 상태줄에 띄우고, 기준을 넘으면 알림을 띄우는 Claude mod.

- 컨텍스트 50% → 작업 끝나면 인계서 갱신하고 새 세션 추천
- 컨텍스트 70% → 지금 인계서 쓰고 새 세션으로 (상태줄에 "교체 권장")
- 5시간·7일 한도 80%, 95% → 한도 경고
- 기준 숫자는 `hooks/register.ts` 맨 위 `CTX_STEPS` / `LIMIT_STEPS`

## Install

At the prompt of a terminal session:

```
/plugin install session-gauge --marketplace handoit86-dev/session-gauge
```

From a shell:

```
claude plugin install session-gauge --marketplace handoit86-dev/session-gauge
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `handoit86-dev/session-gauge`, then Add plugin.
