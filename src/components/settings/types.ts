// 설정 페이지에서 사용하는 공용 타입

export interface ISquadUserRow {
  userId: string;
  role: "owner" | "admin" | "member";
  username: string;
  joinedAt: string;
  attendedMatches: number;
  totalMatches: number;
  attendanceRate: number;
}
