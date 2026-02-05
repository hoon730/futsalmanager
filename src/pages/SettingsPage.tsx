import { Card } from "@/components/ui";
import { MemberAdd, MemberList } from "@/components/member";
import { useSquadStore } from "@/stores/squadStore";

const SettingsPage = () => {
  const squad = useSquadStore((state) => state.squad);

  return (
    <div className="space-y-6">
      <Card title="멤버 관리">
        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-4">
            {squad?.members.length || 0}명 등록
          </p>
          <MemberAdd />
        </div>

        <div className="mt-6">
          <MemberList />
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
