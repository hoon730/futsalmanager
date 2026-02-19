import { useState } from "react";
import DivisionPage from "@/pages/DivisionPage";
import AttendancePage from "@/pages/AttendancePage";
import SettingsPage from "@/pages/SettingsPage";

const Layout = () => {
  const [activeTab, setActiveTab] = useState<"division" | "attendance" | "settings">("division");

  return (
    <div className="flex flex-col h-[100dvh] bg-background-dark text-white max-w-md mx-auto relative">
      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        {activeTab === "division" && <DivisionPage />}
        {activeTab === "attendance" && <AttendancePage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/80 backdrop-blur-xl border-t border-white/5 h-20 flex items-center justify-around max-w-md mx-auto rounded-t-[2.5rem] px-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" style={{ zIndex: 50 }}>
        <button
          onClick={() => setActiveTab('division')}
          className={`flex flex-col items-center gap-1.5 transition-all ${
            activeTab === 'division' ? 'text-primary scale-110' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <span className="material-icons text-2xl">sports_soccer</span>
          <span className="text-[9px] font-black uppercase tracking-widest">팀 배정</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center gap-1.5 transition-all ${
            activeTab === 'attendance' ? 'text-primary scale-110' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <span className="material-icons text-2xl">analytics</span>
          <span className="text-[9px] font-black uppercase tracking-widest">기록</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1.5 transition-all ${
            activeTab === 'settings' ? 'text-primary scale-110' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <span className="material-icons text-2xl">settings</span>
          <span className="text-[9px] font-black uppercase tracking-widest">설정</span>
        </button>
      </nav>

      {/* 장식 효과 */}
      <div className="fixed top-0 right-0 -z-10 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
      <div className="fixed bottom-0 left-0 -z-10 w-80 h-80 bg-primary/5 blur-[120px] rounded-full"></div>
    </div>
  );
};

export default Layout;
