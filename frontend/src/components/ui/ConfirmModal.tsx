import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  loading?: boolean;
  /** Libellé du bouton de confirmation (défaut : « Supprimer »). */
  confirmLabel?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  confirmLabel,
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title ?? t('confirm.titre_suppression')} size="sm">
      <p style={{ color: 'var(--ink-3)', marginBottom: 24 }}>{message ?? t('common.confirmation_suppression')}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {t('actions.annuler')}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel ?? t('actions.supprimer')}
        </Button>
      </div>
    </Modal>
  );
}
