// "내 선수 프로필" 카드. SettingsPage 에서 분리.
// - linkedMemberId (auth.user_metadata.member_id) 와 squad members 를 매핑해 표시
// - 케밥 메뉴: 정보 수정 / 선수 변경 / 연결 해제
// - EditMyMemberModal, LinkMemberModal 내부 호스팅
import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useSquadStore } from "@/stores/squadStore";
import { supabase } from "@/lib/supabase";
import { toast } from "@/stores/toastStore";
import { toFriendlyMessage } from "@/lib/errorMessage";
import { EditMyMemberModal } from "./EditMyMemberModal";
import { LinkMemberModal } from "./LinkMemberModal";
import type { IMember } from "@/types";

export function MyMemberCard() {
  const { user, updateLinkedMember } = useAuthStore();
  const { squad, updateMember } = useSquadStore();
  const members = squad?.members || [];

  const [linkedMemberId, setLinkedMemberId] = useState<string | null>(
    (user?.user_metadata?.member_id as string) ?? null
  );
  const [linkLoading, setLinkLoading] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showMyProfileMenu, setShowMyProfileMenu] = useState(false);

  // 수정 모달 상태
  const [showEditMyMember, setShowEditMyMember] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState<"GK" | "DF" | "MF" | "FW" | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // 정규 멤버 (용병 제외) — LinkMemberModal 선수 후보 및 me 매칭에 사용
  const membersOnly = useMemo(() =>
    [...members.filter((m) => !m.isMercenary)].sort((a, b) =>
      a.name.localeCompare(b.name, ["ko", "en"])
    ),
    [members]
  );

  // auth user 가 갱신되면 linkedMemberId 도 동기화
  useEffect(() => {
    const memberId = (user?.user_metadata?.member_id as string) ?? null;
    setLinkedMemberId(memberId);
  }, [user?.user_metadata?.member_id]);

  const handleLinkMember = async (member: IMember | null) => {
    setLinkLoading(true);
    try {
      await updateLinkedMember(member?.id ?? null);
      setLinkedMemberId(member?.id ?? null);
      setShowLinkPicker(false);
      toast(member ? `"${member.name}"으로 연결되었습니다` : "선수 프로필 연결이 해제되었습니다");
    } catch {
      setShowLinkPicker(false);
      toast("연결에 실패했습니다. 잠시 후 다시 시도해주세요.", "error");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleStartEditMyMember = () => {
    if (!linkedMemberId) return;
    const m = membersOnly.find((x) => x.id === linkedMemberId);
    setEditName(m?.name ?? "");
    setEditPosition((m?.positionKey as "GK" | "DF" | "MF" | "FW" | undefined) ?? null);
    setShowEditMyMember(true);
  };

  const handleSaveMyMember = async () => {
    const trimmed = editName.trim();
    if (!trimmed) { toast("이름을 입력해주세요", "error"); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.rpc("update_my_linked_member", {
        p_name: trimmed,
        p_position_key: editPosition,
      });
      if (error) throw error;
      if (linkedMemberId) {
        updateMember(linkedMemberId, {
          name: trimmed,
          positionKey: editPosition ?? undefined,
        });
      }
      setShowEditMyMember(false);
      toast("내 선수 정보가 저장되었습니다");
    } catch (e) {
      toast(toFriendlyMessage(e, "저장에 실패했습니다"), "error");
    } finally {
      setEditSaving(false);
    }
  };

  /** 사진 업로드 후 DB + 로컬 store 동기화 */
  const handleMemberAvatarUpload = async (memberId: string, url: string) => {
    const { error } = await supabase
      .from("members")
      .update({ avatar_url: url })
      .eq("id", memberId);
    if (error) throw error;
    updateMember(memberId, { avatarUrl: url });
  };

  if (!user) return null;

  const me = linkedMemberId ? membersOnly.find((m) => m.id === linkedMemberId) : null;

  return (
    <>
      <div className="px-6 mb-6">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">내 선수 프로필</p>
          {linkedMemberId ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-xs font-bold">
                    {me?.name?.slice(0, 1) ?? "?"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate">
                    {me?.name ?? "알 수 없음"}
                    {me?.positionKey && (
                      <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-primary/70 px-1.5 py-0.5 rounded-md bg-primary/10">
                        {me.positionKey}
                      </span>
                    )}
                  </p>
                  <p className="text-primary text-[10px] font-black uppercase tracking-widest">연결됨</p>
                </div>
              </div>
              {/* 케밥 메뉴 */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowMyProfileMenu((v) => !v)}
                  aria-label="내 선수 프로필 메뉴"
                  aria-haspopup="menu"
                  aria-expanded={showMyProfileMenu}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors active:scale-90"
                >
                  <span className="material-icons text-lg" aria-hidden="true">more_vert</span>
                </button>
                {showMyProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMyProfileMenu(false)} />
                    <div
                      role="menu"
                      className="absolute right-0 top-10 z-20 rounded-xl overflow-hidden whitespace-nowrap shadow-lg min-w-[140px]"
                      style={{ background: "rgba(28,34,28,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <button
                        role="menuitem"
                        onClick={() => { handleStartEditMyMember(); setShowMyProfileMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-white/80 hover:bg-white/5 transition-colors"
                      >
                        <span className="material-icons text-white/50" style={{ fontSize: "14px" }} aria-hidden="true">edit</span>
                        정보 수정
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { setShowLinkPicker(true); setShowMyProfileMenu(false); }}
                        disabled={linkLoading}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-white/80 hover:bg-white/5 transition-colors border-t border-white/5 disabled:opacity-40"
                      >
                        <span className="material-icons text-white/50" style={{ fontSize: "14px" }} aria-hidden="true">swap_horiz</span>
                        선수 변경
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { handleLinkMember(null); setShowMyProfileMenu(false); }}
                        disabled={linkLoading}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5 disabled:opacity-40"
                      >
                        <span className="material-icons text-red-400/70" style={{ fontSize: "14px" }} aria-hidden="true">link_off</span>
                        연결 해제
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLinkPicker(true)}
              disabled={linkLoading}
              className="w-full flex items-center gap-3 py-2 text-white/30 hover:text-white/60 transition-colors"
            >
              <span className="material-icons text-sm" aria-hidden="true">link</span>
              <span className="text-xs font-black uppercase tracking-widest">
                {linkLoading ? "처리 중..." : "내 이름 선택하기"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 내 선수 정보 수정 모달 */}
      {showEditMyMember && linkedMemberId && (
        <EditMyMemberModal
          memberId={linkedMemberId}
          name={editName}
          position={editPosition}
          avatarUrl={me?.avatarUrl}
          saving={editSaving}
          onChangeName={setEditName}
          onChangePosition={setEditPosition}
          onAvatarChange={(url) => handleMemberAvatarUpload(linkedMemberId, url)}
          onClose={() => setShowEditMyMember(false)}
          onSubmit={handleSaveMyMember}
        />
      )}

      {/* 선수 프로필 선택 모달 */}
      {showLinkPicker && (
        <LinkMemberModal
          members={membersOnly}
          linkedMemberId={linkedMemberId}
          currentUserId={user.id}
          onClose={() => setShowLinkPicker(false)}
          onLink={handleLinkMember}
        />
      )}
    </>
  );
}
