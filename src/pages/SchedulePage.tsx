import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSquadStore } from '@/stores/squadStore';
import { useMatchStore } from '@/stores/matchStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import type { IMatch, IMatchAttendee } from '@/types';

export default function SchedulePage() {
  const { squad } = useSquadStore();
  const { user } = useAuthStore();
  const { matches, attendees, isLoading, loadMatches, loadAttendees, createMatch, deleteMatch, toggleAttendance } = useMatchStore();

  const [userRole, setUserRole] = useState<string>('member');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);

  const now = new Date();
  const upcoming = matches.filter((m) => new Date(m.matchDate) >= now);
  const past = matches.filter((m) => new Date(m.matchDate) < now).reverse();

  useEffect(() => {
    if (!squad?.id) return;
    loadMatches(squad.id);
  }, [squad?.id]);

  useEffect(() => {
    matches.forEach((m) => {
      if (!attendees[m.id]) loadAttendees(m.id);
    });
  }, [matches.length]);

  // 운영자 여부 확인
  useEffect(() => {
    if (!user || !squad?.id) return;
    supabase
      .from('squad_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('squad_id', squad.id)
      .single()
      .then(({ data }) => {
        if (data) setUserRole(data.role);
      });
  }, [user?.id, squad?.id]);

  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const handleToggle = async (matchId: string) => {
    if (!user) return;
    setLoadingMatchId(matchId);
    try {
      // member_id: squad 멤버 중 현재 유저와 연결된 멤버 (없으면 null)
      await toggleAttendance(matchId, user.id, undefined);
    } finally {
      setLoadingMatchId(null);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col min-h-full relative">
      {/* 헤더 */}
      <header className="px-6 pt-12 pb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
              경기 일정
            </h1>
            <div className="h-1 w-8 bg-primary mt-3 rounded-full shadow-[0_0_10px_#0df23e]" />
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
              style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
            >
              <span className="material-icons text-sm">add</span>
              추가
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 pb-8 space-y-4">
        {isLoading && (
          <div className="py-20 text-center">
            <div className="loading-spinner mx-auto mb-3" />
            <p className="text-white/20 text-xs">로딩 중...</p>
          </div>
        )}

        {!isLoading && upcoming.length === 0 && (
          <div className="py-20 text-center">
            <span className="material-icons text-white/10 text-5xl">calendar_today</span>
            <p className="text-xs text-white/20 mt-4">예정된 경기가 없습니다</p>
            {isAdmin && (
              <p className="text-xs text-white/20 mt-1">오른쪽 상단 버튼으로 경기를 추가하세요</p>
            )}
          </div>
        )}

        {/* 예정 경기 */}
        {upcoming.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            attendees={attendees[match.id] || []}
            userId={user?.id}
            isAdmin={isAdmin}
            isLoading={loadingMatchId === match.id}
            onToggle={() => handleToggle(match.id)}
            onDelete={isAdmin ? () => deleteMatch(match.id) : undefined}
          />
        ))}

        {/* 지난 경기 */}
        {past.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast((v) => !v)}
              className="flex items-center gap-2 text-white/30 text-xs font-black uppercase tracking-widest py-2 hover:text-white/50 transition-colors"
            >
              <span className="material-icons text-sm">
                {showPast ? 'expand_less' : 'expand_more'}
              </span>
              지난 경기 {past.length}건
            </button>
            {showPast && (
              <div className="space-y-3 mt-2">
                {past.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    attendees={attendees[match.id] || []}
                    userId={user?.id}
                    isAdmin={isAdmin}
                    isPast
                    isLoading={false}
                    onToggle={() => {}}
                    onDelete={isAdmin ? () => deleteMatch(match.id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 경기 생성 모달 */}
      {showCreateModal && (
        <CreateMatchModal
          squadId={squad?.id || ''}
          userId={user?.id || ''}
          onClose={() => setShowCreateModal(false)}
          onCreate={createMatch}
        />
      )}
    </div>
  );
}

// ─── MatchCard ───────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: IMatch;
  attendees: IMatchAttendee[];
  userId?: string;
  isAdmin: boolean;
  isPast?: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}

function MatchCard({ match, attendees, userId, isAdmin, isPast, isLoading, onToggle, onDelete }: MatchCardProps) {
  const attending = attendees.filter((a) => a.status === 'attending');
  const isAttending = attending.some((a) => a.userId === userId);
  const date = new Date(match.matchDate);

  const dateStr = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`rounded-2xl border transition-all ${isPast ? 'opacity-50' : ''} ${isAttending && !isPast ? 'border-primary/30 bg-primary/5' : 'border-white/5 bg-white/5'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* 날짜 블록 */}
          <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center border ${isAttending && !isPast ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/5'}`}>
            <span className={`text-xs font-black ${isAttending && !isPast ? 'text-primary' : 'text-white/40'}`}>
              {date.toLocaleDateString('ko-KR', { month: 'short' })}
            </span>
            <span className="text-xl font-black text-white leading-tight">{date.getDate()}</span>
          </div>

          {/* 경기 정보 */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base uppercase tracking-wide truncate">{match.title}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-white/40 text-xs">{dateStr} {timeStr}</span>
              {match.location && (
                <span className="flex items-center gap-1 text-white/30 text-xs">
                  <span className="material-icons text-[10px]">location_on</span>
                  {match.location}
                </span>
              )}
            </div>
            {/* 참가 현황 */}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-black ${isAttending && !isPast ? 'text-primary' : 'text-white/40'}`}>
                {attending.length} / {match.maxPlayers}명
              </span>
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((attending.length / match.maxPlayers) * 100, 100)}%`,
                    backgroundColor: isAttending ? '#0DF23E' : 'rgba(255,255,255,0.2)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* 삭제 버튼 (운영자) */}
          {isAdmin && onDelete && (
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500/50 hover:text-red-500 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <span className="material-icons text-sm">delete</span>
            </button>
          )}
        </div>

        {/* RSVP 버튼 */}
        {!isPast && (
          <button
            onClick={onToggle}
            disabled={isLoading}
            className={`mt-3 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 ${
              isAttending
                ? 'bg-primary/10 border border-primary/30 text-primary'
                : 'bg-white/5 border border-white/10 text-white/50 hover:border-white/20'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="material-icons text-sm animate-spin">refresh</span>처리 중
              </span>
            ) : isAttending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="material-icons text-sm">check_circle</span>참가 확정 — 취소하기
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-icons text-sm">sports_soccer</span>참가 신청
              </span>
            )}
          </button>
        )}

        {/* 메모 */}
        {match.notes && (
          <p className="mt-2 text-white/30 text-xs leading-relaxed border-t border-white/5 pt-2">
            {match.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── CreateMatchModal ─────────────────────────────────────────────────────────

interface CreateMatchModalProps {
  squadId: string;
  userId: string;
  onClose: () => void;
  onCreate: (squadId: string, data: Omit<IMatch, 'id' | 'createdAt' | 'squadId'>) => Promise<void>;
}

function CreateMatchModal({ squadId, userId, onClose, onCreate }: CreateMatchModalProps) {
  const [title, setTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [location, setLocation] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await onCreate(squadId, {
        title,
        matchDate: new Date(matchDate).toISOString(),
        location: location || undefined,
        maxPlayers,
        notes: notes || undefined,
        createdBy: userId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '경기 생성 실패');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-lg flex items-end justify-center z-[9999] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[2.5rem] p-6 pb-10"
        style={{ background: 'rgba(22,28,22,0.98)', border: '1px solid rgba(13,242,62,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />

        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white mb-1">경기 추가</h2>
        <div className="h-0.5 w-6 bg-primary rounded-full shadow-[0_0_8px_#0df23e] mb-6" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">경기 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 5월 3주차 경기"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">날짜 / 시간</label>
            <input
              type="datetime-local"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">장소 (선택)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="풋살장 이름"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">최대 인원</label>
              <input
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                min={2}
                max={50}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-all text-center font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">메모 (선택)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="공지사항, 준비물 등"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/40 transition-all active:scale-95"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || !title || !matchDate}
              className="flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: '#0DF23E', color: '#0a150d' }}
            >
              {isLoading ? '생성 중...' : '경기 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
