import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import DivisionPage from "@/pages/DivisionPage";
import AttendancePage from "@/pages/AttendancePage";
import SettingsPage from "@/pages/SettingsPage";
import { useSquadStore } from "@/stores/squadStore";

interface ILayoutProps {
  children?: ReactNode;
  isConnected: boolean;
}

const Layout = (props: ILayoutProps) => {
  const { isConnected } = props;
  const [activeTab, setActiveTab] = useState<"division" | "attendance" | "settings">("division");
  const [headerHidden, setHeaderHidden] = useState(false);
  const squad = useSquadStore((state) => state.squad);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        // 스크롤 다운 & 50px 이상
        setHeaderHidden(true);
      } else {
        // 스크롤 업
        setHeaderHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="app-container">
      {/* 헤더 */}
      <header className={`app-header ${headerHidden ? "hidden" : ""}`}>
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
          {activeTab === "settings" && <SettingsPage isConnected={isConnected} />}
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
