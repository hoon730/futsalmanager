// 동호회 회원(인증 유저) 섹션. SettingsPage 에서 분리.
// - 운영자/관리자만 RPC 호출 (비-운영자는 RPC가 'Unauthorized' 42501 → HTTP 403)
// - RPC 실패 시 2단계 폴백 쿼리 (FK 없는 구조 대응)
// - SquadUserDetailModal 까지 내부에서 관리
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { toast } from "@/stores/toastStore";
import { ConfirmModal } from "@/components/modals";
import type { ISquadUserRow } from "./types";
import { SquadUserDetailModal } from "./SquadUserDetailModal";

interface Props {
  squadId: string;
  isOwnerOrAdmin: boolean;
  userRole: string | null;
  currentUserId: string | null;
}

type RoleOrder = { owner: 0; admin: 1; member: 2 };
const ROLE_ORDER: RoleOrder = { owner: 0, admin: 1, member: 2 };
const INITIAL_VISIBLE = 5;

export function SquadUsersSection({ squadId, isOwnerOrAdmin, userRole, currentUserId }: Props) {
  const [squadUsers, setSquadUsers] = useState<ISquadUserRow[]>([]);
  const [squadUsersLoading, setSquadUsersLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedSquadUser, setSelectedSquadUser] = useState<ISquadUserRow | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const loadSquadUsers = async () => {
    if (!squadId) return;
    setSquadUsersLoading(true);
    try {
      const { data, error } = await supabase
        .rpc("get_squad_users_with_stats", { p_squad_id: squadId });
      if (error) throw error;

      const rows: ISquadUserRow[] = (data || []).map((row: {
        o_user_id: string; o_role: string; o_username: string; o_joined_at: string;
        o_attended_matches: number; o_total_matches: number; o_attendance_rate: number;
      }) => ({
        userId: row.o_user_id,
        role: row.o_role as ISquadUserRow["role"],
        username: row.o_username,
        joinedAt: row.o_joined_at,
        attendedMatches: Number(row.o_attended_matches),
        totalMatches: Number(row.o_total_matches),
        attendanceRate: row.o_attendance_rate,
      }));
      setSquadUsers(rows);
    } catch (e) {
      // RPC 미배포 / 권한 오류 시 — FK 없는 2단계 폴백
      logger.error("get_squad_users_with_stats 실패, 폴백 쿼리 시도:", e);
      try {
        const { data: smRows, error: smErr } = await supabase
          .from("squad_members")
          .select("user_id, role, joined_at")
          .eq("squad_id", squadId);
        if (smErr) throw smErr;

        const userIds = (smRows || []).map((r) => r.user_id);
        let profileMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds);
          profileMap = Object.fromEntries(
            (profileRows || []).map((p) => [p.id, p.username || "알 수 없음"]),
          );
        }

        const rows: ISquadUserRow[] = (smRows || []).map((row) => ({
          userId: row.user_id,
          role: row.role as ISquadUserRow["role"],
          username: profileMap[row.user_id] || "알 수 없음",
          joinedAt: row.joined_at,
          attendedMatches: 0,
          totalMatches: 0,
          attendanceRate: 0,
        }))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

        setSquadUsers(rows);
      } catch (fbE) {
        logger.error("폴백 쿼리도 실패:", fbE);
      }
    } finally {
      setSquadUsersLoading(false);
    }
  };

  useEffect(() => {
    if (!isOwnerOrAdmin) { setSquadUsers([]); return; }
    loadSquadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId, isOwnerOrAdmin]);

  const handleChangeRole = async (userId: string, newRole: "admin" | "member") => {
    if (!squadId || userRole !== "owner") return;
    const { error } = await supabase
      .from("squad_members")
      .update({ role: newRole })
      .eq("squad_id", squadId)
      .eq("user_id", userId);
    if (error) { toast("역할 변경에 실패했습니다", "error"); return; }
    setSquadUsers((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, role: newRole } : u))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
    );
  };

  const handleRemoveSquadMember = (userId: string, username: string) => {
    if (!squadId) return;
    setConfirmModal({
      isOpen: true,
      title: "회원 내보내기",
      message: `${username}님을 동호회에서 내보내시겠습니까?`,
      onConfirm: async () => {
        const { error } = await supabase
          .from("squad_members")
          .delete()
          .eq("squad_id", squadId)
          .eq("user_id", userId);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        if (error) { toast("내보내기에 실패했습니다", "error"); return; }
        setSquadUsers((prev) => prev.filter((u) => u.userId !== userId));
        toast(`${username} 멤버를 내보냈습니다`);
      },
    });
  };

  if (!isOwnerOrAdmin) return null;

  return (
    <>
      <div className="px-6 mb-6 mt-14">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              동호회 회원 {squadUsers.length > 0 ? `· ${squadUsers.length}명` : ""}
            </p>
            <button
              onClick={loadSquadUsers}
              disabled={squadUsersLoading}
              aria-label="동호회 회원 목록 새로고침"
              className="text-white/20 hover:text-white/50 transition-colors"
            >
              <span className="material-icons text-sm" aria-hidden="true">refresh</span>
            </button>
          </div>

          {squadUsersLoading ? (
            <p className="text-white/20 text-xs py-2">로딩 중...</p>
          ) : squadUsers.length === 0 ? (
            <p className="text-white/20 text-xs py-2">회원 정보가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {(expanded ? squadUsers : squadUsers.slice(0, INITIAL_VISIBLE)).map((u) => {
                const isMe = u.userId === currentUserId;
                const roleBadge: Record<string, { label: string; color: string }> = {
                  owner: { label: "OWNER", color: "#FFD700" },
                  admin: { label: "ADMIN", color: "#0DF23E" },
                  member: { label: "MEMBER", color: "rgba(255,255,255,0.3)" },
                };
                const badge = roleBadge[u.role];
                const clickable = userRole === "owner" && !isMe;
                return (
                  <button
                    key={u.userId}
                    onClick={() => clickable && setSelectedSquadUser(u)}
                    disabled={!clickable}
                    className={`w-full flex items-center gap-3 py-2 px-1 -mx-1 rounded-lg transition-colors text-left ${clickable ? "hover:bg-white/[0.03] active:bg-white/[0.05] cursor-pointer" : "cursor-default"}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ backgroundColor: isMe ? "rgba(13,242,62,0.15)" : "rgba(255,255,255,0.07)", color: isMe ? "#0DF23E" : "rgba(255,255,255,0.5)" }}
                    >
                      {u.username[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="flex-1 text-sm font-bold text-white truncate">
                      {u.username}
                      {isMe && <span className="ml-1.5 text-[9px] text-white/30 font-black uppercase tracking-widest">나</span>}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: badge.color }}>
                      {badge.label}
                    </span>
                    {clickable && (
                      <span className="material-icons text-white/20 text-sm flex-shrink-0" aria-hidden="true">chevron_right</span>
                    )}
                  </button>
                );
              })}
              {squadUsers.length > INITIAL_VISIBLE && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 mt-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
                >
                  <span className="material-icons text-sm" style={{ fontSize: 14 }}>
                    {expanded ? "expand_less" : "expand_more"}
                  </span>
                  {expanded
                    ? "접기"
                    : `${squadUsers.length - INITIAL_VISIBLE}명 더보기`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedSquadUser && (
        <SquadUserDetailModal
          user={selectedSquadUser}
          onClose={() => setSelectedSquadUser(null)}
          onChangeRole={handleChangeRole}
          onRemove={handleRemoveSquadMember}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </>
  );
}
