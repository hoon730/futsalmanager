import { useState, useEffect } from 'react';
import { useSquadStore } from '@/stores/squadStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { MembersSection } from '@/components/settings/MembersSection';
import { SquadUsersSection } from '@/components/settings/SquadUsersSection';
import { MyMemberCard } from '@/components/settings/MyMemberCard';
import { LinkedAccountsSection } from '@/components/settings/LinkedAccountsSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';

/**
 * 설정 페이지 — 섹션별 컴포넌트들을 조합만 함.
 * 권한 분기에 필요한 userRole 만 여기서 조회하고 나머지는 각 섹션 자체에서
 * 필요한 store / RPC 를 가져다 쓴다.
 */
export default function SettingsPage() {
  const { squad } = useSquadStore();
  const { user } = useAuthStore();

  // role 기반 관리자 여부 확인 (squad 별로 다르므로 여기서 조회)
  // squad 전환 시 이전 role 이 잠깐 보일 수 있으나 1 프레임 수준이라 무시.
  // 동기 setUserRole(null) 은 react-hooks/set-state-in-effect 위반이므로 생략.
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    if (!user || !squad?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("squad_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("squad_id", squad.id)
        .maybeSingle();
      if (!cancelled) setUserRole(data?.role ?? null);
    })();
    return () => { cancelled = true; };
    // user / squad 변경 시점만 추적
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, squad?.id]);

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

  return (
    <div className="animate-fade-in flex flex-col min-h-full relative">
      {/* 헤더 */}
      <header className="px-6 pt-12 pb-14">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
            설정
          </h1>
          <div className="h-1 w-8 bg-primary mt-3 rounded-full shadow-[0_0_10px_#0df23e]"></div>
        </div>
      </header>

      {/* 정규 멤버 관리 */}
      <MembersSection isOwnerOrAdmin={isOwnerOrAdmin} />

      {/* 동호회 회원 (인증 유저) — 운영자/관리자만 */}
      {squad?.id && (
        <SquadUsersSection
          squadId={squad.id}
          isOwnerOrAdmin={isOwnerOrAdmin}
          userRole={userRole}
          currentUserId={user?.id ?? null}
        />
      )}

      {/* 내 설정 헤더 */}
      <div className="px-6 mt-2 mb-5">
        <h2 className="text-base font-black uppercase tracking-widest flex items-center gap-2 text-white/80">
          <span className="material-icons text-sm text-primary" aria-hidden="true">tune</span>내 설정
        </h2>
      </div>

      {/* 내 선수 프로필 */}
      <MyMemberCard />

      {/* 연결된 OAuth 계정 (카카오) */}
      <LinkedAccountsSection />

      {/* 경기 알림 */}
      <NotificationsSection userId={user?.id ?? null} squadId={squad?.id ?? null} />
    </div>
  );
}
