# ⚽ 풋살 팀 나누기 - React 프로젝트

## 📌 프로젝트 개요
풋살 경기를 위한 공정하고 스마트한 팀 배정 웹 애플리케이션

**목표**: 매번 다른 조합으로 팀을 나누어 공정한 경기 진행

**프로덕션 URL**: https://futsalmanager.vercel.app

---

## ✅ 완료된 기능

### 1. React + TypeScript 마이그레이션 (v2.0.0)
- **Vite 7.2.4**: 초고속 빌드 툴
- **React 19.2.0**: 최신 프론트엔드 프레임워크
- **TypeScript 5.9.3**: 타입 안정성
- **Tailwind CSS 4.1.18**: 현대적인 디자인 시스템

### 2. 상태 관리 및 데이터 페칭
- **Zustand 5.0.11**: 간단한 상태 관리
- **TanStack Query 5.90.20**: 데이터 페칭, 캐싱, 동기화
- **React Hook Form 7.71.1**: 폼 관리
- **Zod 4.3.6**: 스키마 검증

### 3. Supabase 클라우드 동기화 ⭐
- **PostgreSQL 데이터베이스**: 클라우드 저장
- **Realtime Subscriptions**: 실시간 동기화
- **자동 동기화**: debounce로 충돌 방지 (409 에러 해결)
- **여러 기기 공유**: 스쿼드 데이터 동기화

### 4. 용병 시스템 ✨
- **용병 추가 시 자동 체크**: UX 개선
- **고정 팀 설정**: 용병을 특정 팀원과 묶기
- **임시 멤버 관리**: 일회성 참가자 처리

### 5. 스쿼드 관리 (컴포넌트 기반)
- **멤버 추가/삭제**: `MemberAdd.tsx`, `MemberList.tsx`
- **스쿼드 이름 변경**: `SquadNameEditor.tsx`
- **정렬 및 페이지네이션**: 리스트 관리 개선
- **Swiper 제스처**: 스와이프로 멤버 관리

### 6. 참가자 선택
- **ParticipantSelector**: 오늘 참가자 체크
- **전체 선택/해제**: 일괄 처리
- **Swiper 지원**: 스와이프 제스처
- **실시간 카운트**: 선택된 인원 수 표시

### 7. 팀 나누기
- **2~6개 팀**: 유연한 팀 개수 선택
- **TeamCountSelector**: 카드형 버튼 UI
- **이력 기반 최적화**: 같은 팀 반복 방지 (1000번 시도)
- **고정 팀 배치**: 다중 인원 그룹 지원

### 8. 팀 배정 결과 표시
- **TeamCards**: Swiper 12.1.0 카드 슬라이더
- **Framer Motion**: 부드러운 애니메이션
- **PC/모바일 통일**: 스타일 일관성
- **팀별 색상 구분**: A~E팀 (5개 팀)

### 9. 결과 저장
- **전반전/후반전 분리**: 2개 버튼
- **다시 섞기**: 팀 재배정
- **이력 관리**: DivisionHistory.tsx
- **상세 보기**: 모달로 결과 확인

### 10. 출석률 통계
- **AttendanceStats**: 총 경기 수, 평균 참가자
- **단골 멤버 TOP 표시**: 상위 멤버 강조
- **전체 멤버 출석률**: 개인별 통계
- **이력 클릭 시 상세 모달**: 경기별 팀 구성 확인

### 11. UI/UX (다크 테마)
- **Tailwind CSS 4**: 최신 디자인 시스템
- **커스텀 UI 컴포넌트**: Button, Card, Checkbox, Input, Modal
- **반응형 디자인**: PC/모바일 최적화
- **다크 테마 색상**: #1a1a1a 배경, #00ff41 액센트

### 12. PWA 지원
- **vite-plugin-pwa 1.2.0**: 자동 서비스 워커 생성
- **Workbox**: 캐싱 전략
- **오프라인 지원**: 기본 기능 오프라인 가능
- **홈 화면 추가**: 네이티브 앱처럼 사용

---

## 🔧 기술 스택

### Frontend
- React 19.2.0 (최신!)
- TypeScript 5.9.3
- Vite 7.2.4 (빌드 툴)

### State Management
- Zustand 5.0.11 (상태 관리)
- TanStack Query 5.90.20 (서버 상태)

### Styling
- Tailwind CSS 4.1.18 (최신!)
- Framer Motion 12.33.0 (애니메이션)

### UI Libraries
- Swiper 12.1.0 (카드 슬라이더)
- React Icons 5.5.0 (아이콘)

### Forms & Validation
- React Hook Form 7.71.1
- Zod 4.3.6 (최신 v4!)
- @hookform/resolvers 5.2.2

### Backend
- Supabase 2.95.2 (PostgreSQL)
- Supabase Realtime (실시간 동기화)

### PWA
- vite-plugin-pwa 1.2.0

### Deployment
- Vercel (자동 배포)

---

## 🐛 해결한 주요 버그

### Bug #1: Supabase 409 Conflict 에러
- **문제**: 동시에 여러 업데이트 요청 시 충돌
- **해결**: debounce 추가 (500ms 지연)
- **파일**: `hooks/useAutoSync.ts`

### Bug #2: Swiper 스와이프 동작 불안정
- **문제**: PC/모바일에서 스와이프가 다르게 동작
- **해결**: Swiper 설정 통일, 스타일 최적화
- **파일**: `components/team/TeamCards.tsx`

### Bug #3: 용병 추가 시 수동 체크 필요
- **문제**: 용병 추가 후 참가자로 체크해야 하는 번거로움
- **해결**: 용병 추가 시 자동 체크 로직 추가
- **파일**: `components/member/MemberAdd.tsx`

### Bug #4: 실시간 동기화 무한 루프
- **문제**: Realtime 업데이트 시 무한 루프 발생
- **해결**: upsert 전략으로 변경, 로컬 상태와 서버 상태 분리
- **파일**: `hooks/useRealtimeSync.ts`

---

## 🎯 향후 개발 계획

### 1. 실력 밸런싱 (난이도: ⭐⭐ 중) - 다음 우선순위
**기능**:
- 멤버별 실력 레벨 설정 (1-10)
- 팀 평균 실력 밸런싱 알고리즘
- 결과 화면에 팀별 평균 실력 표시

**알고리즘 개선안**:
```typescript
// 점수 = (이력 페널티) + (실력 불균형 페널티)
score = teammateHistoryScore + skillImbalanceScore

// 팀 간 실력 차이 최소화
const avgSkillDiff = Math.abs(teamA.avgSkill - teamB.avgSkill)
skillImbalanceScore = avgSkillDiff * 10
```

**구현 계획**:
1. Member 타입에 `skill_level?: number` 추가
2. MemberAdd에 실력 레벨 입력 필드 추가
3. 팀 나누기 알고리즘에 실력 밸런싱 로직 통합
4. TeamCards에 팀 평균 실력 표시

---

### 2. MVP 투표 (난이도: ⭐⭐⭐ 상) - 장기 계획
**기능**:
- 경기 후 MVP 투표 UI
- 투표 집계 및 결과 표시
- MVP 이력 통계 (월간/연간)
- 중복 투표 방지

**기술적 도전**:
- Supabase Realtime으로 실시간 투표 집계
- IP 또는 디바이스 ID 기반 중복 투표 방지
- 투표 익명성 보장

**데이터베이스 스키마**:
```sql
CREATE TABLE mvp_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  division_id UUID REFERENCES divisions(id),
  voter_device_id TEXT NOT NULL,
  voted_player_id UUID REFERENCES members(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(division_id, voter_device_id)
);
```

---

## 📂 프로젝트 구조 (상세)

```
futsal-app/
├── src/
│   ├── App.tsx                           # 메인 앱 (탭 구조)
│   ├── main.tsx                          # React 엔트리 포인트
│   ├── index.css                         # Tailwind 글로벌 스타일 (54KB)
│   │
│   ├── components/
│   │   ├── attendance/                   # 출석률 통계
│   │   │   ├── AttendanceStats.tsx      # 통계 표시
│   │   │   ├── DivisionHistory.tsx       # 이력 목록
│   │   │   └── index.ts
│   │   │
│   │   ├── fixedTeam/                    # 고정 팀 관리
│   │   │   ├── FixedTeamManager.tsx      # 고정 팀 UI
│   │   │   └── index.ts
│   │   │
│   │   ├── member/                       # 멤버 관리
│   │   │   ├── MemberAdd.tsx             # 멤버 추가 (용병 포함)
│   │   │   ├── MemberList.tsx            # 멤버 리스트 (Swiper)
│   │   │   └── index.ts
│   │   │
│   │   ├── participant/                  # 참가자 선택
│   │   │   ├── ParticipantSelector.tsx   # 체크박스 선택
│   │   │   └── index.ts
│   │   │
│   │   ├── settings/                     # 설정
│   │   │   ├── SquadNameEditor.tsx       # 스쿼드 이름 변경
│   │   │   └── index.ts
│   │   │
│   │   ├── team/                         # 팀 결과
│   │   │   ├── TeamCards.tsx             # Swiper 카드 슬라이더
│   │   │   ├── TeamCountSelector.tsx     # 팀 개수 선택 모달
│   │   │   └── index.ts
│   │   │
│   │   ├── modals/                       # 공통 모달
│   │   │   ├── AlertModal.tsx            # 알림 모달
│   │   │   ├── ConfirmModal.tsx          # 확인 모달
│   │   │   └── index.ts
│   │   │
│   │   ├── ui/                           # 기본 UI 컴포넌트
│   │   │   ├── Button.tsx                # 버튼
│   │   │   ├── Card.tsx                  # 카드
│   │   │   ├── Checkbox.tsx              # 체크박스
│   │   │   ├── Input.tsx                 # 입력 필드
│   │   │   ├── Modal.tsx                 # 기본 모달
│   │   │   └── index.ts
│   │   │
│   │   └── Layout.tsx                    # 앱 레이아웃 (헤더/탭/푸터)
│   │
│   ├── hooks/                            # Custom Hooks
│   │   ├── useAutoSync.ts                # 자동 동기화 (debounce)
│   │   ├── useInitialLoad.ts             # 초기 데이터 로드
│   │   └── useRealtimeSync.ts            # Supabase Realtime 구독
│   │
│   ├── lib/
│   │   └── supabase.ts                   # Supabase 클라이언트 초기화
│   │
│   ├── stores/                           # Zustand 상태 관리
│   │   ├── squadStore.ts                 # 스쿼드 상태
│   │   ├── divisionStore.ts              # 팀 배정 상태
│   │   └── uiStore.ts                    # UI 상태 (모달 등)
│   │
│   ├── types/                            # TypeScript 타입
│   │   ├── index.ts                      # 공통 타입
│   │   ├── member.ts                     # Member 관련 타입
│   │   └── division.ts                   # Division 관련 타입
│   │
│   └── pages/                            # 페이지 컴포넌트 (향후 라우팅)
│       └── (미사용 - 현재 SPA)
│
├── public/                               # 정적 파일
│   ├── icon-192.png                      # PWA 아이콘
│   ├── icon-512.png
│   ├── icon-192-maskable.png
│   ├── icon-512-maskable.png
│   └── favicon.ico
│
├── .env                                  # Supabase 환경 변수
├── .env.example                          # 환경 변수 예시
├── .gitignore                            # Git 무시 파일
├── vite.config.ts                        # Vite 설정 (PWA 포함)
├── tailwind.config.js                    # Tailwind 설정
├── postcss.config.js                     # PostCSS 설정
├── tsconfig.json                         # TypeScript 설정
├── tsconfig.app.json                     # 앱용 TS 설정
├── tsconfig.node.json                    # Node용 TS 설정
├── eslint.config.js                      # ESLint 설정
├── package.json                          # 의존성
├── package-lock.json                     # 잠금 파일
├── vercel.json                           # Vercel 배포 설정
├── supabase-setup.sql                    # DB 스키마
├── TROUBLESHOOTING.md                    # 문제 해결 가이드
├── README.md                             # 사용자 문서
└── CLAUDE.md                             # 이 파일 (개발자 문서)
```

---

## 💾 데이터 구조

### Supabase 테이블 스키마

#### 1. squads 테이블
```sql
CREATE TABLE squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. members 테이블
```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skill_level INTEGER DEFAULT 5,  -- 향후 밸런싱용
  is_mercenary BOOLEAN DEFAULT false,  -- 용병 여부
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. divisions 테이블
```sql
CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  division_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period TEXT CHECK (period IN ('전반전', '후반전')),
  team_count INTEGER NOT NULL,
  teams JSONB NOT NULL,  -- 팀 배정 결과 (JSON 배열)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. fixed_teams 테이블
```sql
CREATE TABLE fixed_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  player_ids UUID[] NOT NULL,  -- 다중 인원 지원
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. teammate_history 테이블
```sql
CREATE TABLE teammate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
  player1_id UUID REFERENCES members(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES members(id) ON DELETE CASCADE,
  count INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(squad_id, player1_id, player2_id)
);
```

---

## 📝 주요 알고리즘

### 팀 나누기 최적화 (team-algorithm.ts)

```typescript
export function divideTeamsWithConstraints(
  participants: Member[],
  teamCount: number,
  fixedTeams: FixedTeam[],
  history: TeammateHistory
): Division | null {
  let bestTeams: Member[][] | null = null;
  let bestScore = Infinity;

  // 1000번 시도
  for (let attempt = 0; attempt < 1000; attempt++) {
    const teams = createRandomTeams(participants, teamCount);

    // 고정 팀 제약 조건 적용
    if (!applyFixedTeamConstraints(teams, fixedTeams)) {
      continue; // 고정 팀 배치 실패 시 다음 시도
    }

    // 점수 계산: 이전에 같은 팀이었던 횟수의 제곱
    const score = calculateScore(teams, history);

    if (score < bestScore) {
      bestScore = score;
      bestTeams = teams;
    }
  }

  return bestTeams;
}

function calculateScore(teams: Member[][], history: TeammateHistory): number {
  let score = 0;

  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const key = `${team[i].id}-${team[j].id}`;
        const count = history[key] || 0;
        score += count * count; // 제곱으로 페널티
      }
    }
  }

  return score;
}
```

---

## 🎨 디자인 시스템

### Tailwind 커스텀 설정

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: '#00ff41',
        'team-a': '#ff6b6b',
        'team-b': '#4facfe',
        'team-c': '#43e97b',
        'team-d': '#fa709a',
        'team-e': '#a8edea',
      },
    },
  },
};
```

### 다크 테마 색상
- **배경**: #1a1a1a
- **카드**: #242424 → #1f1f1f (그라디언트)
- **액센트**: #00ff41 (네온 그린)
- **텍스트**: rgba(255, 255, 255, 0.9)

---

## 🔧 개발 참고사항

### 주요 Custom Hooks

#### useAutoSync
```typescript
// 자동 동기화 (debounce 500ms)
export function useAutoSync(squadId: string) {
  const debouncedSync = useMemo(
    () => debounce((data) => syncToSupabase(data), 500),
    [squadId]
  );

  useEffect(() => {
    return () => debouncedSync.cancel();
  }, [debouncedSync]);

  return debouncedSync;
}
```

#### useRealtimeSync
```typescript
// Supabase Realtime 구독
export function useRealtimeSync(squadId: string) {
  useEffect(() => {
    const subscription = supabase
      .channel(`squad:${squadId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        (payload) => handleChange(payload)
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [squadId]);
}
```

---

## 🎓 배운 점

### React 19 마이그레이션
- **새로운 훅**: `use()`, `useFormStatus()` 등
- **자동 배치**: 더 나은 성능
- **Suspense 개선**: 데이터 페칭 통합

### Tailwind CSS 4
- **성능 개선**: 더 빠른 빌드
- **새로운 문법**: `@layer` 개선
- **자동 완성**: 더 나은 IDE 지원

### Zustand vs Redux
- **보일러플레이트 감소**: 훨씬 간단한 코드
- **TypeScript 지원**: 완벽한 타입 안정성
- **Persist**: 로컬스토리지 동기화 쉬움

### TanStack Query
- **자동 캐싱**: 네트워크 요청 최소화
- **Optimistic Updates**: 즉각적인 UI 업데이트
- **에러 처리**: 자동 재시도

### Supabase Realtime
- **WebSocket**: 실시간 동기화
- **Postgres Changes**: 데이터베이스 변경 감지
- **Presence**: 사용자 온라인 상태 (향후 활용)

---

## 📞 문제 해결 가이드

### Supabase 연결 오류
**증상**: "Failed to fetch" 에러
**해결**:
1. `.env` 파일 확인
2. Supabase 프로젝트가 일시 중지되었는지 확인
3. 네트워크 연결 확인

### 실시간 동기화 안 됨
**증상**: 다른 기기에서 변경사항이 반영 안 됨
**해결**:
1. Supabase 대시보드 → Database → Replication 확인
2. 테이블에 Realtime 활성화되어 있는지 확인
3. `useRealtimeSync` 훅이 호출되는지 확인

### 409 Conflict 에러
**증상**: Supabase 업데이트 시 충돌
**해결**:
- `useAutoSync` 훅의 debounce 시간 늘리기 (현재 500ms)
- 동시 업데이트 로직 검토

### PWA 업데이트 안 됨
**증상**: 코드 변경 후에도 이전 버전 표시
**해결**:
1. 브라우저 캐시 강제 새로고침 (Ctrl+Shift+R)
2. Service Worker 제거 후 재설치
3. `manifest.json`의 버전 번호 확인

---

## 🚀 배포 가이드

### Vercel 자동 배포
1. GitHub 저장소 연결
2. 환경 변수 설정:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. `main` 브랜치에 push → 자동 배포

### 수동 배포
```bash
npm run build
vercel --prod
```

---

## 📊 성능 최적화

### Vite 빌드 최적화
- **Code Splitting**: 자동 청크 분할
- **Tree Shaking**: 사용하지 않는 코드 제거
- **Minification**: 코드 압축

### React 최적화
- **React.memo**: 불필요한 리렌더링 방지
- **useMemo/useCallback**: 연산 및 함수 메모이제이션
- **Lazy Loading**: 컴포넌트 지연 로딩 (향후)

### Tailwind 최적화
- **PurgeCSS**: 사용하지 않는 스타일 제거
- **JIT 모드**: 필요한 스타일만 생성

---

**프로젝트 상태**: ✅ 프로덕션 배포 완료
**다음 단계**: 실력 밸런싱 기능 개발
**장기 계획**: MVP 투표 시스템
