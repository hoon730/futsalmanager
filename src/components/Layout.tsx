import { useState } from "react";
import type { ReactNode } from "react";
import DivisionPage from "@/pages/DivisionPage";
import AttendancePage from "@/pages/AttendancePage";
import SettingsPage from "@/pages/SettingsPage";
import { useSquadStore } from "@/stores/squadStore";

interface ILayoutProps {
  children?: ReactNode;
}

const Layout = (_props: ILayoutProps) => {
  const [activeTab, setActiveTab] = useState<"division" | "attendance" | "settings">("division");
  const squad = useSquadStore((state) => state.squad);

  return (
    <div className="app-container">
      {/* 헤더 */}
      <header className="app-header">
        <h1>⚽ 풋살 매니저</h1>
        <p className="squad-name">{squad?.name || "내 스쿼드"}</p>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="app-main">
        <div className={`tab-content ${activeTab === "division" ? "active" : ""}`}>
          {activeTab === "division" && <DivisionPage />}
        </div>
        <div className={`tab-content ${activeTab === "attendance" ? "active" : ""}`}>
          {activeTab === "attendance" && <AttendancePage />}
        </div>
        <div className={`tab-content ${activeTab === "settings" ? "active" : ""}`}>
          {activeTab === "settings" && <SettingsPage />}
        </div>
      </main>

      {/* 하단 탭 네비게이션 */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === "division" ? "active" : ""}`}
          onClick={() => setActiveTab("division")}
        >
          <span className="tab-icon">⚽</span>
          <span className="tab-label">팀배정</span>
        </button>
        <button
          className={`tab-btn ${activeTab === "attendance" ? "active" : ""}`}
          onClick={() => setActiveTab("attendance")}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">출석률</span>
        </button>
        <button
          className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">설정</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
