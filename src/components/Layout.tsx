import { useState } from "react";
import DivisionPage from "@/pages/DivisionPage";
import AttendancePage from "@/pages/AttendancePage";
import SettingsPage from "@/pages/SettingsPage";
import SchedulePage from "@/pages/SchedulePage";
import { UserMenuPanel } from "@/components/club/UserMenuPanel";
import { useAuthStore } from "@/stores/authStore";
import { useSquadStore } from "@/stores/squadStore";

type Tab = "division" | "schedule" | "attendance" | "settings";

const Layout = () => {
  const [activeTab, setActiveTab] = useState<Tab>("division");
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile, user } = useAuthStore();
  const { squad } = useSquadStore();

  const avatarLetter = (profile?.username || user?.email || "?")[0].toUpperCase();

  return (
    <div className="flex flex-col h-[100dvh] bg-background-dark text-white max-w-md mx-auto relative">

      {/* 상단 헤더 */}
      <header className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0" style={{ zIndex: 40 }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#00ff41] text-xs font-black opacity-60">⚽</span>
          <span className="text-white/70 text-sm font-bold truncate max-w-[160px]">
            {squad?.name || "풋살 매니저"}
          </span>
        </div>
        {user && (
          <button
            onClick={() => setMenuOpen(true)}
            className="w-8 h-8 rounded-full bg-[#00ff41]/20 border border-[#00ff41]/30 flex items-center justify-center flex-shrink-0 hover:bg-[#00ff41]/30 transition-colors"
          >
            <span className="text-[#00ff41] text-xs font-bold">{avatarLetter}</span>
          </button>
        )}
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-28">
        {activeTab === "division"   && <DivisionPage />}
        {activeTab === "schedule"   && <SchedulePage />}
        {activeTab === "attendance" && <AttendancePage />}
        {activeTab === "settings"   && <SettingsPage />}
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
            onClick={() => setActiveTab(id)}
            className="flex flex-col items-center justify-center gap-1.5 h-full transition-all"
            style={{
              width: "25%",
              color: activeTab === id ? "#0df23e" : "rgba(255,255,255,0.2)",
              transform: activeTab === id ? "scale(1.1)" : "scale(1)",
            }}
          >
            <span className="material-icons text-2xl">{icon}</span>
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
