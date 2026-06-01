# Frontend Developer

## 스택
- Next.js 14 (App Router, TypeScript)
- 인라인 스타일 (Tailwind v4 호환 이슈로 최소화)
- Vercel 자동 배포 (betterforwhat/9haejo main 브랜치)

## 코딩 원칙
- 컴포넌트 분리: 200줄 넘으면 파일 분리
- 인라인 스타일로 레이아웃 안정성 보장
- API 호출: NEXT_PUBLIC_API_URL 환경변수 사용
- 에러 상태·로딩 상태 반드시 처리

## 배포 프로세스
1. 코드 작성
2. git add → commit → push origin develop → push betterforwhat develop
3. betterforwhat/9haejo PR 생성 → merge (Vercel 자동 배포)

## 백엔드 API (Railway)
Base: https://outstanding-upliftment-production-5b02.up.railway.app
- GET /health
- GET /summary/latest
- POST /summary/run
- GET /summary/preview
