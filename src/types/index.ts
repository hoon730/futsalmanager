export interface IMember {
  id: string;
  name: string;
  skillLevel?: number;
  active: boolean;
  createdAt: string;
  isMercenary?: boolean; // 용병 여부
  avatarUrl?: string; // 프로필 이미지
  positionKey?: string; // 포지션 (FW, MF, DF, GK 등)
  linkedUserId?: string | null; // 이 선수에 연결된 user_id (1:1)
}

export interface ISquad {
  id: string;
  name: string;
  members: IMember[];
  createdAt: string;
}

export interface IDivision {
  id: string;
  squadId: string;
  matchId?: string;
  divisionDate: string;
  notes?: string;
  period: "전반전" | "후반전";
  teams: IMember[][];
  teamCount: number;
}

export interface IFixedTeam {
  id: string;
  playerIds: string[];
  players?: IMember[];
  active: boolean;
}

export interface ITeammateHistory {
  [key: string]: number;
}

export interface IAttendanceStats {
  memberId: string;
  name: string;
  attended: number;
  total: number;
  rate: number;
}

export interface IMatch {
  id: string;
  squadId: string;
  title: string;
  matchDate: string;
  location?: string;
  maxPlayers: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  rsvpDeadline?: string | null; // 참가 신청 마감 시각 (ISO 8601). null = 마감 해제
}

export interface IMatchAttendee {
  id: string;
  matchId: string;
  userId: string;
  memberId?: string;
  status: 'attending' | 'absent' | 'pending' | 'waitlist';
  registeredAt: string;
  username?: string; // profiles 조인 결과
}

export interface IMatchComment {
  id: string;
  matchId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;       // 대댓글이면 부모 댓글 ID
  replies?: IMatchComment[]; // 클라이언트에서 조립
}
