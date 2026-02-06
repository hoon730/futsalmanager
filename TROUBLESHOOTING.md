# 데이터 동기화 문제 해결

## 증상
- PC에서 데이터 입력/저장 완료
- 핸드폰에서 데이터가 보이지 않음

## 확인 사항

### 1. Supabase에 데이터가 저장되었는지 확인
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택 (ghxvnhilldzfadegofcc)
3. Table Editor 메뉴
4. `squads` 테이블 확인 → "내 스쿼드" 데이터 있는지
5. `members` 테이블 확인 → 24명 멤버 있는지
6. `divisions` 테이블 확인 → 이력 1건 있는지

### 2. 핸드폰 브라우저 콘솔 확인
Chrome 모바일:
1. chrome://inspect 접속 (PC Chrome에서)
2. 핸드폰 USB 연결
3. 핸드폰에서 앱 열기
4. PC에서 inspect 클릭
5. Console 탭에서 에러 확인

Safari 모바일:
1. 설정 → Safari → 고급 → Web Inspector 활성화
2. Mac에서 Safari → 개발 → 핸드폰 선택
3. Console 확인

### 3. 네트워크 확인
- 핸드폰이 인터넷에 연결되어 있는지
- Supabase URL 접근 가능한지

### 4. 캐시 문제
- 핸드폰 브라우저 캐시 삭제
- 시크릿 모드로 접속 시도

## 예상 원인

1. **Supabase에 저장 안됨** → PC 콘솔에 업로드 에러 확인
2. **핸드폰에서 로드 실패** → 네트워크/CORS 이슈
3. **Realtime 미작동** → Replication 설정 미완료
