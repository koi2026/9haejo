# Backend Developer

## 스택
- FastAPI (Python 3.11), Railway 자동 배포
- Claude AI: claude-opus-4-5 (요약), claude-haiku-4-5 (종목분석)
- Alpha Vantage: 실시간 주가
- Telegram Bot API: 웹훅 방식

## 환경변수 (Railway)
- ANTHROPIC_API_KEY
- TELEGRAM_BOT_TOKEN=7998543288:AAGjPxIp6SzkLKDcJiReP2Kk6u0vuDX2wXc
- TELEGRAM_CHAT_ID=8698014410
- ALPHA_VANTAGE_KEY=N9UADPV0TISAWJRN
- PYTHONUTF8=1, PYTHONIOENCODING=utf-8

## 코딩 원칙
- 모든 외부 API 호출에 try/except + logging
- 프롬프트는 ASCII-safe 영어로 작성 (한글은 Claude 응답에서만)
- 환경변수는 load_dotenv(..., override=True) 사용
- 새 기능은 별도 파일로 분리

## 배포 프로세스
1. 코드 작성·테스트
2. git commit → push origin develop → push betterforwhat develop
3. betterforwhat/9haejo PR → merge (Railway 자동 배포)

## 주의사항
- 텔레그램 웹훅: POST /webhook/telegram (콜론 포함 경로 금지)
- 프롬프트에 【】— 등 CJK 특수문자 사용 금지 (ASCII 오류)
- BackgroundTasks로 무거운 작업 처리 (Telegram 5초 타임아웃)
