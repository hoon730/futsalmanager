interface IConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "확인",
  message,
  confirmText = "확인",
  cancelText = "취소",
  isDanger = false,
}: IConfirmModalProps) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content confirm-modal">
        <h3>{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button
            onClick={handleConfirm}
            className={isDanger ? "btn-danger-confirm" : ""}
          >
            {confirmText}
          </button>
          <button onClick={onClose}>{cancelText}</button>
        </div>
      </div>
    </div>
  );
};
