# 🔍 9haejo (구해조)

> 월가의 밤, 당신의 아침에 — Claude AI가 분석한 미국 증시 브리핑을 매일 오전 8시 텔레그램으로 전달합니다.

[![CI](https://github.com/norandal/9haejo/actions/workflows/ci.yml/badge.svg)](https://github.com/norandal/9haejo/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![KOI 2026](https://img.shields.io/badge/KOI-2026%20Spring%20B트랙-orange)](https://github.com/norandal/9haejo)
[![Vercel](https://img.shields.io/badge/Vercel-9haejo.vercel.app-black?logo=vercel)](https://9haejo.vercel.app)
[![Telegram](https://img.shields.io/badge/Telegram-@goohaejo__bot-2CA5E0?logo=telegram)](https://t.me/goohaejo_bot)

---

## 🌐 라이브 서비스

| 채널 | 링크 |
|------|------|
| 🌐 웹 대시보드 | [9haejo.vercel.app](https://9haejo.vercel.app) |
| 📱 텔레그램 봇 | [@goohaejo_bot](https://t.me/goohaejo_bot) |
| 📸 Instagram | [@opensource_9haejo](https://www.instagram.com/opensource_9haejo/) |
| 🐙 GitHub | [norandal/9haejo](https://github.com/norandal/9haejo) |

---

## 📌 서비스 소개

미국 증시 마감 후 Claude AI가 200개 이상의 데이터 포인트를 분석하고,  
**매일 오전 8시 KST**에 텔레그램으로 브리핑을 자동 전송합니다.

```
📈 미국 증시 마감  →  🤖 Claude AI 분석  →  📱 텔레그램 자동 전송
   yfinance 데이터      200+ 데이터 포인트     매일 08:00 KST
```

### 주요 기능

| 기능 | 설명 |
|------|------|
| 🤖 **AI 브리핑** | S&P500·나스닥·환율·섹터·빅테크를 한국어로 요약 |
| 🔍 **종목 즉시 분석** | 티커 입력 시 AI 분석 리포트 즉시 발송 |
| 📋 **관심종목 알림** | `/watchlist add NVDA` 로 관심종목 등록 및 알림 |
| 💱 **한국 투자자 맞춤** | USD/KRW 환율 영향, 삼성·하이닉스·카카오·네이버 분석 |
| ⚡ **실시간 시황** | `/시황` 으로 주요 지수·빅테크 현황 즉시 확인 |
| 📊 **섹터 분석** | `/sector 반도체` 처럼 섹터별 흐름 한국어 제공 |

---

## ⌨️ 텔레그램 커맨드

[@goohaejo_bot](https://t.me/goohaejo_bot) 에서 바로 사용하세요.

| 커맨드 | 설명 |
|--------|------|
| `/브리핑` | AI 미국 증시 브리핑 즉시 조회 |
| `/시황` | 지수·환율·공포탐욕 현황 |
| `/뉴스` | 월가 뉴스 한국어 요약 |
| `/뉴스 NVDA` | 종목별 뉴스 요약 |
| `/매크로` | VIX·DXY·금리·오일·금 |
| `/상승 반도체` | 섹터별 상승 종목 랭킹 |
| `/종목전망 NVDA` | 주간 전망 AI 분석 |
| `/compare NVDA TSLA` | 종목 비교 분석 |
| `/watchlist add NVDA` | 관심종목 추가·조회 |
| `/알림 NVDA 200` | 가격 알림 등록 |
| `/포트폴리오` | 관심종목 AI 진단 |
| `/구독` | 매일 8시 브리핑 구독 |

전체 커맨드 목록 → [9haejo.vercel.app/commands](https://9haejo.vercel.app/commands)

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| **프론트엔드** | Next.js · Vercel |
| **백엔드** | FastAPI · Railway |
| **AI 엔진** | Claude AI (Anthropic) |
| **시세 데이터** | yfinance |
| **메시지 채널** | Telegram Bot API |

---

## 🗂️ 프로젝트 구조

```
9haejo/
├── main.py                    # 파이프라인 실행 진입점
├── requirements.txt           # 의존성 목록
├── .env.example               # 환경 변수 템플릿
├── ai-log.md                  # AI 사용 이력 로그
│
├── src/
│   ├── fetcher/
│   │   ├── market_data.py     # 미국 지수·종목 데이터 수집 (yfinance)
│   │   └── stock_data.py      # 개별 종목 상세 데이터
│   ├── ai/
│   │   └── summarizer.py      # Claude API 브리핑 생성
│   └── publisher/
│       └── twitter.py         # SNS 게시 모듈
│
├── tests/
│   └── test_market_data.py
│
└── .github/
    └── workflows/
        ├── ci.yml             # PR 자동 테스트
        └── daily_summary.yml  # 평일 오전 8시 자동 실행
```

---

## 🚀 로컬 실행

### 1. 저장소 클론

```bash
git clone https://github.com/norandal/9haejo.git
cd 9haejo
```

### 2. 의존성 설치

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일에 아래 키 입력
```

`.env` 필수 항목:

```env
ANTHROPIC_API_KEY=your_key_here
TELEGRAM_BOT_TOKEN=your_token_here
PUBLISH_ENABLED=false          # true로 변경 시 실제 전송
```

### 4. 실행

```bash
python main.py       # dry-run: 브리핑 생성 후 출력만
```

---

## 🧪 테스트

```bash
pytest tests/ -v
```

---

## 🤝 기여하기

기여를 환영합니다! 먼저 [CONTRIBUTING.md](CONTRIBUTING.md)를 읽어주세요.

**Good First Issues**

| 이슈 | 라벨 |
|------|------|
| Claude API 요약 프롬프트 고도화 | `good-first-issue` |
| 한국 주식(KOSPI) 데이터 수집 추가 | `good-first-issue` |
| 텔레그램 자동 게시 모듈 구현 | `enhancement` |
| 단위 테스트 커버리지 확대 | `good-first-issue` |
| GitHub Actions 스케줄러 안정화 | `enhancement` |

---

## 👥 팀 구성

| 역할 | 담당자 | 책임 |
|------|--------|------|
| **Maintainer** | 강현경 | 저장소 방향성, PR 병합 기준 수립 |
| **Contributor** | 박상준 | AI 모델 연동, 기능 구현 |
| **Docs** | 김하율 | README, 문서화, 발표 자료 |
| **AI / Automation** | 강현경 | 프롬프트 엔지니어링, ai-log.md 관리 |

---

## 🤖 AI 사용 정책

본 프로젝트는 AI 도구 사용 내역을 [ai-log.md](ai-log.md)에 투명하게 기록합니다.  
모든 AI 생성 콘텐츠는 게시 전 **인간이 직접 검토**합니다.

---

## 📄 라이선스

[MIT License](LICENSE) © 2026 구해조 팀

---

> ⚠️ 본 서비스의 콘텐츠는 **투자 권유가 아닙니다.** 투자 판단은 본인 책임입니다.

> **KOI (KAIST Opensource Impact) 2026 Spring** | B트랙 — 자체 AI·오픈소스 운영  
> _"AI를 활용하여 복잡한 시장 상황과 개별 기업의 핵심 정보를 한눈에 파악할 수 있는 가장 신뢰성 높은 요약 서비스를 제공한다."_
