import { useState } from "react";
import type { ReactNode } from "react";
import DivisionPage from "@/pages/DivisionPage";
import AttendancePage from "@/pages/AttendancePage";
import SettingsPage from "@/pages/SettingsPage";

interface ILayoutProps {
  children?: ReactNode;
}

const Layout = ({ children }: ILayoutProps) => {
  const [activeTab, setActiveTab] = useState<"division" | "attendance" | "settings">("division");

  const tabs = [
    { id: "division" as const, label: "팀 배정", icon: "⚽" },
    { id: "attendance" as const, label: "출석률", icon: "📊" },
    { id: "settings" as const, label: "설정", icon: "⚙️" },
  ];

  const renderPage = () => {
    switch (activeTab) {
      case "division":
        return <DivisionPage />;
      case "attendance":
        return <AttendancePage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DivisionPage />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-card to-background px-4 py-4 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-neon">
          ⚽ 풋살 팀 나누기
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        {children || renderPage()}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex border-t border-gray-700 bg-card">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === tab.id
                ? "text-neon"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
