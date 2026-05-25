// 정규 멤버 관리 섹션. SettingsPage 에서 분리.
// - 멤버 페이지네이션(가로 스와이프) + 드래그 스크롤
// - 추가/편집/삭제 모달 내부 호스팅
// - squadStore 직접 사용, 외부에는 isOwnerOrAdmin 만 필요
import { useState, useRef, useMemo, useEffect } from "react";
import { useSquadStore } from "@/stores/squadStore";
import { supabase } from "@/lib/supabase";
import { toast } from "@/stores/toastStore";
import { ConfirmModal } from "@/components/modals";
import { AddMemberModal } from "./AddMemberModal";
import { MemberEditModal } from "./MemberEditModal";
import type { IMember } from "@/types";

interface Props {
  isOwnerOrAdmin: boolean;
}

const ITEMS_PER_PAGE = 5;

export function MembersSection({ isOwnerOrAdmin }: Props) {
  const { squad, addMember, removeMember, updateMember } = useSquadStore();
  const members = squad?.members || [];

  // 정규 멤버만 (용병 제외), 가나다 정렬
  const membersOnly = useMemo(() =>
    [...members.filter((m) => !m.isMercenary)].sort((a, b) =>
      a.name.localeCompare(b.name, ["ko", "en"])
    ),
    [members]
  );
  const totalPages = Math.ceil(membersOnly.length / ITEMS_PER_PAGE);

  // 페이지네이션 + 드래그 스크롤
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  // 모달 상태
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [editingMember, setEditingMember] = useState<IMember | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // 추가 모달 ESC 닫기
  useEffect(() => {
    if (!addMemberModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAddMemberModal(false);
        setNewMemberName("");
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [addMemberModal]);

  // 스크롤 핸들러
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.clientWidth;
    if (width > 0) setCurrentPage(Math.round(scrollLeft / width));
  };
  const handlePageClick = (i: number) => {
    scrollRef.current?.scrollTo({ left: i * (scrollRef.current.clientWidth), behavior: "smooth" });
    setCurrentPage(i);
  };
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    dragScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.5;
    if (Math.abs(walk) > 5) {
      hasDragged.current = true;
      e.preventDefault();
      scrollRef.current.scrollLeft = dragScrollLeft.current - walk;
    }
  };
  const onMouseUp = () => {
    if (isDragging.current) {
      const el = scrollRef.current;
      if (el && hasDragged.current) {
        const page = Math.round(el.scrollLeft / el.clientWidth);
        setCurrentPage(page);
        el.scrollTo({ left: page * el.clientWidth, behavior: "smooth" });
      }
    }
    isDragging.current = false;
  };

  // 멤버 추가
  const handleAddMember = () => {
    setNewMemberName("");
    setAddMemberModal(true);
  };
  const handleAddMemberConfirm = () => {
    const trimmedName = newMemberName.trim();
    if (!trimmedName) return;
    if (members.some((m) => m.name === trimmedName)) {
      setAddMemberModal(false);
      setNewMemberName("");
      toast("이미 등록된 멤버입니다", "error");
      return;
    }
    addMember({
      id: Date.now().toString(),
      name: trimmedName,
      active: true,
      createdAt: new Date().toISOString(),
    });
    setAddMemberModal(false);
    setNewMemberName("");
    toast(`${trimmedName} 멤버가 추가되었습니다`);
  };

  // 멤버 삭제
  const handleRemoveMember = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "멤버 삭제",
      message: `${name} 멤버를 삭제하시겠습니까?`,
      onConfirm: () => {
        removeMember(id);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        toast(`${name} 멤버가 삭제되었습니다`);
      },
    });
  };

  // 편집 제출
  const handleEditMemberSubmit = (updates: {
    name: string;
    positionKey?: "GK" | "DF" | "MF" | "FW";
    skillLevel: number;
  }) => {
    if (!editingMember) return;
    updateMember(editingMember.id, updates);
    toast(`${updates.name} 정보가 수정되었습니다`);
    setEditingMember(null);
  };

  // 사진 업로드 → DB + 로컬 store 동기화
  const handleMemberAvatarUpload = async (memberId: string, url: string) => {
    const { error } = await supabase
      .from("members")
      .update({ avatar_url: url })
      .eq("id", memberId);
    if (error) throw error;
    updateMember(memberId, { avatarUrl: url });
  };

  return (
    <>
      <main className="flex-1 px-6">
        {/* 멤버 관리 */}
        <div className="flex items-center justify-between mb-5 mt-1">
          <h2 className="text-base font-black uppercase tracking-widest flex items-center gap-2 text-white/80">
            <span className="material-icons text-sm text-primary" aria-hidden="true">groups</span>멤버 관리
          </h2>
          {isOwnerOrAdmin && (
            <button
              onClick={handleAddMember}
              aria-label="선수 추가"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
              style={{ backgroundColor: "rgba(13,242,62,0.10)", color: "#0DF23E", border: "1px solid rgba(13,242,62,0.25)" }}
            >
              <span className="material-icons text-sm" aria-hidden="true">person_add</span>
              선수 추가
            </button>
          )}
        </div>

        {/* 현재 멤버 수 */}
        <div className="mb-6 bg-white/5 p-5 rounded-2xl border border-white/5">
          <div className="text-primary font-black text-md italic">
            현재 {membersOnly.length}명
          </div>
        </div>

        {/* 멤버 리스트 (페이지네이션) */}
        {membersOnly.length === 0 ? (
          <div className="py-20 text-center">
            <span className="material-icons text-white/10 text-5xl" aria-hidden="true">group_off</span>
            <p className="text-xs text-white/20 mt-4">등록된 멤버가 없습니다</p>
            <p className="text-xs text-white/20 mt-2">오른쪽 하단 버튼을 눌러 멤버를 추가하세요</p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className="flex snap-x snap-mandatory overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing select-none"
          >
            {Array.from({ length: totalPages }).map((_, pageIdx) => (
              <div key={pageIdx} className="w-full flex-shrink-0 snap-center space-y-3">
                {membersOnly
                  .slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE)
                  .map((member) => (
                    <div
                      key={member.id}
                      onClick={isOwnerOrAdmin ? () => setEditingMember(member) : undefined}
                      className={`rounded-2xl p-5 bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all group${isOwnerOrAdmin ? " cursor-pointer active:scale-[0.98]" : ""}`}
                    >
                      <div className="flex items-center gap-4">
                        {member.avatarUrl ? (
                          <img
                            className="w-12 h-12 rounded-full object-cover border border-white/10 flex-shrink-0"
                            src={member.avatarUrl}
                            alt={member.name}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-white/10 flex-shrink-0">
                            <span className="text-md font-bold">{member.name.slice(0, 1)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base text-white truncate">{member.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {member.positionKey && (
                              <span className="text-[10px] text-primary font-black uppercase tracking-widest">
                                {member.positionKey}
                              </span>
                            )}
                            {isOwnerOrAdmin && (member.skillLevel ?? 0) > 0 && (
                              <span className="text-[10px] text-yellow-400/70">
                                {"★".repeat(member.skillLevel ?? 3)}{"☆".repeat(5 - (member.skillLevel ?? 3))}
                              </span>
                            )}
                          </div>
                        </div>
                        {isOwnerOrAdmin && (
                          <span className="material-icons text-white/10 group-hover:text-primary transition-colors" aria-hidden="true">chevron_right</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* 페이지 인디케이터 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageClick(i)}
                aria-label={`${i + 1}페이지로 이동`}
                aria-current={currentPage === i ? "page" : undefined}
                className="h-1.5 rounded-full transition-all duration-300"
                style={currentPage === i
                  ? { width: "2rem", backgroundColor: "#0DF23E", boxShadow: "0 0 8px rgba(13,242,62,0.5)" }
                  : { width: "0.5rem", backgroundColor: "rgba(255,255,255,0.1)" }
                }
              />
            ))}
          </div>
        )}
      </main>

      {/* 관리자 멤버 편집 모달 */}
      {editingMember && isOwnerOrAdmin && (
        <MemberEditModal
          memberId={editingMember.id}
          name={editingMember.name}
          position={(editingMember.positionKey as "GK" | "DF" | "MF" | "FW") ?? null}
          skillLevel={editingMember.skillLevel ?? 3}
          avatarUrl={editingMember.avatarUrl}
          onClose={() => setEditingMember(null)}
          onSubmit={handleEditMemberSubmit}
          onAvatarChange={async (url) => {
            await handleMemberAvatarUpload(editingMember.id, url);
            setEditingMember((prev) => prev ? { ...prev, avatarUrl: url } : prev);
          }}
          onDelete={() => {
            const target = editingMember;
            setEditingMember(null);
            handleRemoveMember(target.id, target.name);
          }}
        />
      )}

      {/* 멤버 추가 모달 */}
      {addMemberModal && (
        <AddMemberModal
          name={newMemberName}
          onChangeName={setNewMemberName}
          onClose={() => { setAddMemberModal(false); setNewMemberName(""); }}
          onConfirm={handleAddMemberConfirm}
        />
      )}

      {/* 삭제 confirm */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
