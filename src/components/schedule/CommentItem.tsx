import { useRef, useState } from "react";
import type { IMatchComment } from "@/types";
import { timeAgo } from "./scheduleUtils";

interface CommentItemProps {
  comment: IMatchComment;
  parentId?: string;
  isReply?: boolean;
  userId?: string;
  onReply: (parentId: string, mentionName: string) => void;
  onAction: (comment: IMatchComment, x?: number, y?: number) => void;
}

export function CommentItem({ comment, parentId, isReply, userId, onReply, onAction }: CommentItemProps) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const swipeFired = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isSwiping.current = false;
    swipeFired.current = false;

    if (comment.userId === userId) {
      longPressTimer.current = setTimeout(() => {
        if (!isSwiping.current) {
          if (navigator.vibrate) navigator.vibrate(50);
          onAction(comment);
        }
      }, 500);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (Math.abs(dy) > Math.abs(dx) + 5) { cancelLongPress(); return; }

    if (dx < -8) {
      isSwiping.current = true;
      cancelLongPress();
      setSwipeX(Math.max(dx, -75));
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (swipeX < -55 && !swipeFired.current) {
      swipeFired.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      onReply(parentId ?? comment.id, comment.username);
    }
    setSwipeX(0);
    isSwiping.current = false;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (comment.userId !== userId) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    onAction(comment, e.clientX, e.clientY);
  };

  const replyIconOpacity = Math.min(Math.abs(swipeX) / 55, 1);

  return (
    <div className={`relative overflow-hidden rounded-xl ${isReply ? "ml-10" : ""}`}>
      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center pointer-events-none"
        style={{ opacity: replyIconOpacity, background: "rgba(13,242,62,0.15)" }}
      >
        <span className="material-icons text-primary text-sm">reply</span>
      </div>

      <div
        className="flex gap-3 py-0.5 select-none"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? "transform 0.22s ease-out" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black mt-0.5"
          style={{ background: "rgba(13,242,62,0.12)", color: "#0DF23E" }}
        >
          {comment.username.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-white/70">{comment.username}</span>
            <span className="text-[10px] text-white/20">{timeAgo(comment.createdAt)}</span>
            {comment.updatedAt && (
              <span className="text-[10px] text-white/15">(수정됨)</span>
            )}
          </div>
          <p className="text-sm text-white/55 mt-0.5 leading-relaxed break-words">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}
