import { describe, it, expect, beforeAll, vi } from "vitest";
import { divideTeamsWithConstraints, updateTeammateHistory } from "./teamAlgorithm";
import type { IMember, IFixedTeam } from "@/types";

// alert / console 은 알고리즘 내부에서 호출되지만 테스트에서는 무시
beforeAll(() => {
  vi.stubGlobal("alert", vi.fn());
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const makeMember = (id: string, name: string, opts: Partial<IMember> = {}): IMember => ({
  id,
  name,
  skillLevel: 3,
  active: true,
  createdAt: "2026-01-01T00:00:00Z",
  ...opts,
});

describe("updateTeammateHistory", () => {
  it("같은 팀 내 모든 페어를 1 증가", () => {
    const teams = [
      [makeMember("a", "A"), makeMember("b", "B"), makeMember("c", "C")],
    ];
    const result = updateTeammateHistory(teams, {});
    expect(result["a-b"]).toBe(1);
    expect(result["a-c"]).toBe(1);
    expect(result["b-c"]).toBe(1);
  });

  it("ID 알파벳 순으로 key 정렬", () => {
    const teams = [[makeMember("z", "Z"), makeMember("a", "A")]];
    const result = updateTeammateHistory(teams, {});
    // key 는 항상 a-z, z-a 가 아님
    expect(result["a-z"]).toBe(1);
    expect(result["z-a"]).toBeUndefined();
  });

  it("기존 history 에 누적", () => {
    const teams = [[makeMember("a", "A"), makeMember("b", "B")]];
    const existing = { "a-b": 5 };
    const result = updateTeammateHistory(teams, existing);
    expect(result["a-b"]).toBe(6);
  });

  it("다른 팀 멤버끼리는 카운트 안 함", () => {
    const teams = [
      [makeMember("a", "A")],
      [makeMember("b", "B")],
    ];
    const result = updateTeammateHistory(teams, {});
    expect(result["a-b"]).toBeUndefined();
  });

  it("입력 history 객체를 변형하지 않음 (immutable)", () => {
    const teams = [[makeMember("a", "A"), makeMember("b", "B")]];
    const original = { "a-b": 1 };
    const result = updateTeammateHistory(teams, original);
    expect(original["a-b"]).toBe(1); // 원본 유지
    expect(result["a-b"]).toBe(2);   // 새 객체에서만 증가
  });
});

describe("divideTeamsWithConstraints", () => {
  it("4명 2팀 → 각 팀 2명씩", async () => {
    const players = ["a", "b", "c", "d"].map((id) => makeMember(id, id.toUpperCase()));
    const result = await divideTeamsWithConstraints(players, 2);
    expect(result).not.toBeNull();
    expect(result!.teams).toHaveLength(2);
    expect(result!.teams[0]).toHaveLength(2);
    expect(result!.teams[1]).toHaveLength(2);
  });

  it("5명 2팀 → 3명 + 2명 (1명 차이 이하)", async () => {
    const players = ["a", "b", "c", "d", "e"].map((id) => makeMember(id, id.toUpperCase()));
    const result = await divideTeamsWithConstraints(players, 2);
    expect(result).not.toBeNull();
    const sizes = result!.teams.map((t) => t.length).sort();
    expect(sizes).toEqual([2, 3]);
  });

  it("참가자 < 팀 개수 → null 반환", async () => {
    const players = [makeMember("a", "A")];
    const result = await divideTeamsWithConstraints(players, 2);
    expect(result).toBeNull();
  });

  it("모든 참가자는 정확히 한 팀에만 배치 (중복/누락 없음)", async () => {
    const players = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => makeMember(id, id));
    const result = await divideTeamsWithConstraints(players, 3);
    expect(result).not.toBeNull();
    const allAssigned = result!.teams.flat().map((p) => p.id).sort();
    expect(allAssigned).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("고정 그룹은 항상 같은 팀에 배치", async () => {
    const players = ["a", "b", "c", "d", "e", "f"].map((id) => makeMember(id, id));
    const fixedTeams: IFixedTeam[] = [
      { id: "f1", playerIds: ["a", "b"], active: true },
    ];
    const result = await divideTeamsWithConstraints(players, 2, fixedTeams);
    expect(result).not.toBeNull();
    const aTeam = result!.teams.findIndex((t) => t.some((p) => p.id === "a"));
    const bTeam = result!.teams.findIndex((t) => t.some((p) => p.id === "b"));
    expect(aTeam).toBe(bTeam);
  });

  it("비활성 고정 그룹은 무시", async () => {
    const players = ["a", "b", "c", "d"].map((id) => makeMember(id, id));
    const fixedTeams: IFixedTeam[] = [
      { id: "f1", playerIds: ["a", "b", "c", "d"], active: false }, // 전부 같은 팀이면 불가능
    ];
    const result = await divideTeamsWithConstraints(players, 2, fixedTeams);
    // active:false 이므로 정상 배치되어야 함
    expect(result).not.toBeNull();
    expect(result!.teams).toHaveLength(2);
  });

  it("GK 4명이 2팀에 분배될 때 한 팀에 몰리지 않음 (대수 테스트)", async () => {
    const players: IMember[] = [
      makeMember("g1", "G1", { positionKey: "GK" }),
      makeMember("g2", "G2", { positionKey: "GK" }),
      makeMember("g3", "G3", { positionKey: "GK" }),
      makeMember("g4", "G4", { positionKey: "GK" }),
      makeMember("f1", "F1"),
      makeMember("f2", "F2"),
      makeMember("f3", "F3"),
      makeMember("f4", "F4"),
    ];
    // 알고리즘은 1000회 시도 후 최소 점수 채택 — GK 페널티(가중치 10)가 가장 큼
    const result = await divideTeamsWithConstraints(players, 2);
    expect(result).not.toBeNull();
    const gkCountPerTeam = result!.teams.map(
      (t) => t.filter((p) => p.positionKey === "GK").length
    );
    // 균등 분배(2/2)가 이상적. 알고리즘은 sqrt 페널티이므로 거의 항상 2/2 채택.
    expect(Math.abs(gkCountPerTeam[0] - gkCountPerTeam[1])).toBeLessThanOrEqual(1);
  });
});
