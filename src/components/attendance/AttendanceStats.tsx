import { useMemo } from "react";
import { Card } from "@/components/ui";
import { useSquadStore } from "@/stores/squadStore";
import { useDivisionStore } from "@/stores/divisionStore";
import type { IAttendanceStats } from "@/types";

export const AttendanceStats = () => {
  const { squad } = useSquadStore();
  const { divisionHistory } = useDivisionStore();

  const stats = useMemo(() => {
    if (!squad) return null;

    const totalGames = divisionHistory.length;
    if (totalGames === 0) return null;

    // 각 멤버별 출석 횟수 계산
    const attendanceMap = new Map<string, number>();

    divisionHistory.forEach((division) => {
      const participantIds = new Set<string>();
      division.teams.forEach((team) => {
        team.forEach((member) => {
          participantIds.add(member.id);
        });
      });

      participantIds.forEach((id) => {
        attendanceMap.set(id, (attendanceMap.get(id) || 0) + 1);
      });
    });

    // 출석률 계산
    const memberStats: IAttendanceStats[] = squad.members.map((member) => {
      const attended = attendanceMap.get(member.id) || 0;
      return {
        memberId: member.id,
        name: member.name,
        attended,
        total: totalGames,
        rate: totalGames > 0 ? (attended / totalGames) * 100 : 0,
      };
    });

    // 출석률 높은 순으로 정렬
    const sortedStats = [...memberStats].sort((a, b) => b.rate - a.rate);

    // 평균 참가자 수
    const totalParticipants = divisionHistory.reduce((sum, division) => {
      const count = division.teams.reduce((teamSum, team) => teamSum + team.length, 0);
      return sum + count;
    }, 0);
    const avgParticipants = Math.round(totalParticipants / totalGames);

    return {
      totalGames,
      avgParticipants,
      topMembers: sortedStats.slice(0, 5),
      allMembers: sortedStats,
    };
  }, [squad, divisionHistory]);

  if (!stats) {
    return (
      <Card title="출석률 통계">
        <p className="text-center text-gray-400">
          아직 팀 나누기 기록이 없습니다
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 전체 통계 */}
      <Card title="전체 통계">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-black/20 p-4 text-center">
            <p className="mb-1 text-sm text-gray-400">총 경기 수</p>
            <p className="text-3xl font-bold text-[#00ff41]">{stats.totalGames}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-4 text-center">
            <p className="mb-1 text-sm text-gray-400">평균 참가자</p>
            <p className="text-3xl font-bold text-[#4facfe]">{stats.avgParticipants}명</p>
          </div>
        </div>
      </Card>

      {/* 단골 멤버 TOP 5 */}
      <Card title="단골 멤버 TOP 5">
        <div className="space-y-2">
          {stats.topMembers.map((member, index) => (
            <div
              key={member.memberId}
              className="flex items-center justify-between rounded-lg bg-black/20 p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    index === 0
                      ? "bg-[#FFD700] text-black"
                      : index === 1
                        ? "bg-[#C0C0C0] text-black"
                        : index === 2
                          ? "bg-[#CD7F32] text-black"
                          : "bg-white/10 text-white"
                  } text-sm font-bold`}
                >
                  {index + 1}
                </div>
                <span className="text-white">{member.name}</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#00ff41]">
                  {member.rate.toFixed(0)}%
                </p>
                <p className="text-xs text-gray-400">
                  {member.attended}/{member.total}회
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 전체 멤버 출석률 */}
      <Card title="전체 멤버 출석률">
        <div className="space-y-2">
          {stats.allMembers.map((member) => (
            <div
              key={member.memberId}
              className="flex items-center justify-between rounded-lg bg-black/20 p-3"
            >
              <span className="text-white">{member.name}</span>
              <div className="flex items-center gap-3">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-[#00ff41]"
                    style={{ width: `${member.rate}%` }}
                  />
                </div>
                <div className="w-16 text-right">
                  <p className="text-sm font-bold text-white">
                    {member.rate.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-400">
                    {member.attended}/{member.total}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
