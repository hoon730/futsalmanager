import { Card } from "@/components/ui";
import { ParticipantSelector } from "@/components/participant";

const DivisionPage = () => {
  return (
    <div className="space-y-6">
      <Card title="오늘 참가자 선택">
        <ParticipantSelector />
      </Card>

      <Card title="팀 나누기">
        <p className="text-center text-gray-500 py-8">
          참가자를 선택하고 팀 나누기 버튼을 눌러주세요
        </p>
      </Card>
    </div>
  );
};

export default DivisionPage;
