export interface IMember {
  id: string;
  name: string;
  skillLevel?: number;
  active: boolean;
  createdAt: string;
  isMercenary?: boolean; // 용병 여부
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
