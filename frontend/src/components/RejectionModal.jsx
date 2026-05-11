import React, { useState } from 'react';
import { X, AlertTriangle, Send } from 'lucide-react';

const RejectionModal = ({ isOpen, onClose, onConfirm, blockName }) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        onConfirm(reason);
        setReason('');
        onClose();
    };

    return (
        <div className="rejection-modal-overlay" onClick={onClose}>
            <div className="rejection-modal-card" onClick={e => e.stopPropagation()}>
                <div className="rejection-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Reject Execution Stage</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{blockName}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="popover-close">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="rejection-modal-body">
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                        Please provide a detailed technical reason for rejecting this stage. This feedback will be sent directly to the assigned engineer.
                    </p>
                    
                    <textarea 
                        autoFocus
                        className="form-control"
                        placeholder="e.g. DRC violations detected in metal 3 layer, please resolve before resubmission..."
                        style={{ width: '100%', minHeight: 100, fontSize: 13, padding: 12, borderRadius: 8, resize: 'none' }}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        required
                    />

                    <div className="rejection-modal-footer">
                        <button type="button" className="btn btn-sm" onClick={onClose}>Cancel</button>
                        <button 
                            type="submit" 
                            className="btn btn-sm btn-danger" 
                            style={{ gap: 6 }}
                            disabled={!reason.trim()}
                        >
                            <Send size={12} /> Confirm Rejection
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                .rejection-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    alignItems: center;
                    justifyContent: center;
                    z-index: 10000;
                    animation: fadeIn 0.2s ease-out;
                }
                .rejection-modal-card {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    width: 100%;
                    max-width: 440px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
                    overflow: hidden;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .rejection-modal-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-light);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .rejection-modal-body {
                    padding: 20px;
                }
                .rejection-modal-footer {
                    margin-top: 20px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default RejectionModal;
