interface IAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export const AlertModal = ({ isOpen, onClose, title = "알림", message }: IAlertModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content alert-modal">
        <h3>{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button onClick={onClose}>확인</button>
        </div>
      </div>
    </div>
  );
};
