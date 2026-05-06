import React, { useState } from 'react';
import { Plus, X, Check, XCircle } from 'lucide-react';
import './RequestsTab.css';

const RequestModal = ({ onClose, onSubmit, engineers }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        stage: 'NOT_STARTED',
        suggestedAssignee: '',
        dueDate: ''
    });

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
        onClose();
    };

    return (
        <div className="request-modal-overlay">
            <div className="request-modal fade-in">
                <div className="request-modal-header">
                    <h3>New Block Request</h3>
                    <button className="nav-icon-btn" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="request-modal-body">
                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input 
                                type="text" 
                                name="title" 
                                required 
                                className="form-control" 
                                value={formData.title} 
                                onChange={handleChange} 
                                placeholder="e.g. CORE_ALU_LAYOUT"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea 
                                name="description" 
                                className="form-control" 
                                rows="3" 
                                value={formData.description} 
                                onChange={handleChange}
                            ></textarea>
                        </div>
                        <div style={{ display: 'flex', gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Priority</label>
                                <select name="priority" className="form-control" value={formData.priority} onChange={handleChange}>
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Suggested Stage</label>
                                <select name="stage" className="form-control" value={formData.stage} onChange={handleChange}>
                                    <option value="NOT_STARTED">Not Started</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="DRC">DRC</option>
                                    <option value="LVS">LVS</option>
                                    <option value="REVIEW">Review</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Suggested Assignee</label>
                                <select name="suggestedAssignee" className="form-control" value={formData.suggestedAssignee} onChange={handleChange}>
                                    <option value="">-- Unassigned --</option>
                                    {engineers.map(eng => (
                                        <option key={eng._id} value={eng._id}>{eng.displayName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Target Due Date</label>
                                <input 
                                    type="date" 
                                    name="dueDate" 
                                    className="form-control" 
                                    value={formData.dueDate} 
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="request-modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Submit Request</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const RequestsTab = ({ requests = [], onCreateRequest = () => {}, onApproveRequest = () => {}, onRejectRequest = () => {}, engineers = [], isManager }) => {
    const [filter, setFilter] = useState('ALL');
    const [showModal, setShowModal] = useState(false);

    // Ultra-safe array check
    const safeRequests = Array.isArray(requests) ? requests : [];

    const filteredRequests = safeRequests.filter(r => {
        if (!r) return false;
        if (filter === 'ALL') return true;
        return r.status === filter;
    });

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="requests-tab-container fade-in">
            <div className="requests-header">
                <div className="requests-title-section">
                    <h2>Requests</h2>
                    <p>Submit and manage block creation requests</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} style={{ marginRight: 6 }} /> New Request
                </button>
            </div>

            <div className="requests-filters">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                    <button 
                        key={f}
                        className={`filter-pill ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {filteredRequests.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📝</div>
                    <h3>No requests found</h3>
                    <p>There are no {filter !== 'ALL' ? filter.toLowerCase() : ''} requests to display.</p>
                </div>
            ) : (
                <table className="requests-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Priority</th>
                            <th>Requested By</th>
                            <th>Suggested Assignee</th>
                            <th>Date</th>
                            <th>Status</th>
                            {isManager && filter === 'PENDING' && <th>Action</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRequests.map(req => (
                            <tr key={req._id}>
                                <td style={{ fontWeight: 600 }}>{req.title}</td>
                                <td>
                                    <span style={{ 
                                        fontSize: 11, 
                                        fontWeight: 700, 
                                        color: req.priority === 'HIGH' ? '#ef4444' : req.priority === 'MEDIUM' ? '#f59e0b' : '#3b82f6'
                                    }}>
                                        {req.priority}
                                    </span>
                                </td>
                                <td>{req.requestedBy?.displayName || 'Unknown'}</td>
                                <td style={{ color: '#64748b' }}>{req.suggestedAssignee?.displayName || '-'}</td>
                                <td>{formatDate(req.createdAt)}</td>
                                <td>
                                    <span className={`status-pill status-${req.status?.toLowerCase() || 'pending'}`}>
                                        {req.status || 'PENDING'}
                                    </span>
                                </td>
                                {isManager && filter === 'PENDING' && (
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button 
                                                className="btn btn-sm" 
                                                style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px' }}
                                                onClick={() => onApproveRequest(req._id)}
                                                title="Approve and Create Block"
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button 
                                                className="btn btn-sm" 
                                                style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 8px' }}
                                                onClick={() => onRejectRequest(req._id)}
                                                title="Reject Request"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {showModal && (
                <RequestModal 
                    onClose={() => setShowModal(false)} 
                    onSubmit={onCreateRequest}
                    engineers={engineers}
                />
            )}
        </div>
    );
};

export default RequestsTab;
