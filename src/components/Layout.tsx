import { useState, useEffect, Suspense } from "react";
import { UserMenuPanel } from "@/components/club/UserMenuPanel";
import { useAuthStore } from "@/stores/authStore";
import { useSquadStore } from "@/stores/squadStore";
import { useMatchStore } from "@/stores/matchStore";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";

// Route-level code splitting: 탭별 페이지를 lazy-load 하여 초기 번들 축소
// lazyWithRetry: 배포 직후 stale chunk 404 발생 시 자동 reload로 복구
const DivisionPage   = lazyWithRetry(() => import("@/pages/DivisionPage"));
const SchedulePage   = lazyWithRetry(() => import("@/pages/SchedulePage"));
const AttendancePage = lazyWithRetry(() => import("@/pages/AttendancePage"));
const SettingsPage   = lazyWithRetry(() => import("@/pages/SettingsPage"));

const PageFallback = () => (
  <div className="flex items-center justify-center h-full py-20">
    <div className="loading-spinner" />
  </div>
);

type Tab = "division" | "schedule" | "attendance" | "settings";

const LAST_SCHEDULE_VISIT_KEY = "lastScheduleVisit";

function pageLabelFor(tab: Tab): string {
  switch (tab) {
    case "division":   return "팀 배정";
    case "schedule":   return "일정";
    case "attendance": return "기록";
    case "settings":   return "설정";
  }
}

// URL의 ?tab=... 으로 초기 탭 결정 (푸시 알림 클릭 시 진입 경로)
function readInitialTab(): Tab {
  if (typeof window === "undefined") return "division";
  try {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "schedule" || t === "division" || t === "attendance" || t === "settings") {
      return t;
    }
  } catch {
    /* ignore */
  }
  return "division";
}

const Layout = () => {
  const [activeTab, setActiveTab] = useState<Tab>(readInitialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile, user } = useAuthStore();
  const { squad } = useSquadStore();
  const { matches, loadMatches } = useMatchStore();

  // 경기 목록 미리 로드 (배지용)
  useEffect(() => {
    if (squad?.id && matches.length === 0) loadMatches(squad.id);
  }, [squad?.id]);

  // 알림 배지: 마지막 일정 탭 방문 이후 추가된 경기 수
  const [lastVisit] = useState<number>(() => {
    const v = localStorage.getItem(LAST_SCHEDULE_VISIT_KEY);
    return v ? Number(v) : 0;
  });
  // Date.now()를 렌더 중 직접 호출하면 react-hooks/purity 위반.
  // useState 지연 초기화는 마운트 시 1회만 실행되므로 안전함.
  const [now] = useState<number>(() => Date.now());
  const newMatchCount = matches.filter(
    (m) =>
      new Date(m.createdAt).getTime() > lastVisit &&
      new Date(m.matchDate).getTime() >= now
  ).length;

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "schedule") {
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now();
      localStorage.setItem(LAST_SCHEDULE_VISIT_KEY, String(now));
    }
  };

  const avatarLetter = (profile?.username || user?.email || "?")[0].toUpperCase();

  return (
    <div className="flex flex-col h-[100dvh] bg-background-dark text-white max-w-md mx-auto relative">

      {/* 상단 헤더 */}
      <header className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0" style={{ zIndex: 40 }}>
        <div className="flex items-center gap-2 min-w-0">
          {squad?.logoUrl ? (
            <img
              src={squad.logoUrl}
              alt={squad.name}
              className="w-6 h-6 rounded-md object-cover border border-white/10 flex-shrink-0"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <span className="text-primary text-xs font-black opacity-60">⚽</span>
          )}
          <span className="text-white/70 text-sm font-bold truncate max-w-[160px]">
            {squad?.name || "풋살 매니저"}
          </span>
        </div>
        {user && (
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="사용자 메뉴 열기"
            className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 hover:bg-primary/30 transition-colors"
          >
            <span className="text-primary text-xs font-bold">{avatarLetter}</span>
          </button>
        )}
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-28">
        <ChunkErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            {/* key={activeTab}: 탭 전환 시 에러 상태 자동 reset */}
            <PageErrorBoundary key={activeTab} pageLabel={pageLabelFor(activeTab)}>
              {activeTab === "division"   && <DivisionPage />}
              {activeTab === "schedule"   && <SchedulePage onGoToDivision={() => setActiveTab("division")} />}
              {activeTab === "attendance" && <AttendancePage />}
              {activeTab === "settings"   && <SettingsPage />}
            </PageErrorBoundary>
          </Suspense>
        </ChunkErrorBoundary>
      </main>

      {/* 하단 네비게이션 — 4탭 */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-background-dark/80 backdrop-blur-xl border-t border-white/5 h-24 flex items-center max-w-md mx-auto rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
        style={{ zIndex: 50 }}
      >
        {(
          [
            { id: "division",   icon: "sports_soccer",  label: "팀 배정" },
            { id: "schedule",   icon: "calendar_today", label: "일정"   },
            { id: "attendance", icon: "analytics",      label: "기록"   },
            { id: "settings",   icon: "settings",       label: "설정"   },
          ] as { id: Tab; icon: string; label: string }[]
        ).map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            aria-label={label}
            aria-current={activeTab === id ? "page" : undefined}
            className="flex flex-col items-center justify-center gap-1.5 h-full transition-all"
            style={{
              width: "25%",
              color: activeTab === id ? "#0df23e" : "rgba(255,255,255,0.2)",
              transform: activeTab === id ? "scale(1.1)" : "scale(1)",
            }}
          >
            <div className="relative">
              <span className="material-icons text-2xl">{icon}</span>
              {id === "schedule" && newMatchCount > 0 && activeTab !== "schedule" && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={{ backgroundColor: "#0DF23E", color: "#0a150d" }}
                >
                  {newMatchCount > 9 ? "9+" : newMatchCount}
                </span>
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
          </button>
        ))}
      </nav>

      {/* 장식 글로우 */}
      <div className="fixed top-0 right-0 -z-10 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
      <div className="fixed bottom-0 left-0 -z-10 w-80 h-80 bg-primary/5 blur-[120px] rounded-full" />

      {/* 유저 메뉴 패널 */}
      <UserMenuPanel isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
};

export default Layout;
