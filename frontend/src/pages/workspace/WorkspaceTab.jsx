import React, { useState, useMemo, useCallback } from 'react';
import WorkspaceHeader from './WorkspaceHeader';
import WorkflowBanner from './WorkflowBanner';
import KpiStrip from './KpiStrip';
import WorkspaceToolbar from './WorkspaceToolbar';
import BulkActionsBar from './BulkActionsBar';
import WorkflowTable from './WorkflowTable';
import BlockDetailsDrawer from './BlockDetailsDrawer';
import { useOrchestration } from '../../context/OrchestrationContext';
import { STAGES, HEALTH_STATES, BLOCK_TYPES, TECH_NODES, COMPLEXITY_LEVELS } from '../../constants/workflowStates';
import './workspace.css';

const WorkspaceTab = ({
    blocks: incomingBlocks = [],
    engineers: incomingEngineers = [],
    analytics,
    showForm,
    setShowForm,
    onCreateBlock,
    onAssign,
    onReview,
    onUpdateStatus,
    onEscalate,
    onSelectBlock,
    selectedBlockId,
    isManager,
    onLoadDemo,
    onResetDataset
}) => {
    const blocks = incomingBlocks;
    const engineers = incomingEngineers;

    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState('ALL');
    const [healthFilter, setHealthFilter] = useState('ALL');
    const [assigneeFilter, setAssigneeFilter] = useState('ALL');
    const [viewMode, setViewMode] = useState('list'); // list | grid | map
    const [quickView, setQuickView] = useState('all');
    const [sortField, setSortField] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [selectedIds, setSelectedIds] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [drawerBlock, setDrawerBlock] = useState(null);
    const [drawerRejectMode, setDrawerRejectMode] = useState(false);

    const setFilter = (type, val) => {
        if (type === 'health') setHealthFilter(val);
        if (type === 'stage') setStageFilter(val);
    };

    const clearFilters = () => {
        setHealthFilter('ALL');
        setStageFilter('ALL');
        setSearchTerm('');
    };

    const [formData, setFormData] = useState({
        name: '', type: BLOCK_TYPES[0], description: '', techNode: TECH_NODES[TECH_NODES.length - 1], 
        complexity: 'SIMPLE', baseHours: 0, estimatedArea: 0, priority: 1, dependencies: [], assignedEngineer: ''
    });

    const handleSort = useCallback((field) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    }, [sortField]);

    const filteredBlocks = useMemo(() => {
        // 1. BASE: Derive ONLY from central store
        let result = [...blocks];

        // 2. QUICKVIEW TABS (highest priority override)
        if (quickView === 'critical') {
            result = result.filter(b => b.health === 'CRITICAL');
        } else if (quickView === 'warning') {
            result = result.filter(b => b.health === 'WARNING');
        } else if (quickView === 'bottleneck') {
            result = result.filter(b => b.health === 'BOTTLENECK');
        } else if (quickView === 'healthy') {
            result = result.filter(b => b.health === 'HEALTHY');
        } else if (quickView === 'unassigned') {
            result = result.filter(b => !b.assignedEngineer && b.status !== STAGES.COMPLETED);
        }

        // 3. STAGE FILTER
        if (stageFilter && stageFilter !== 'ALL') {
            result = result.filter(b => b.status === stageFilter);
        }

        // 4. HEALTH FILTER
        if (healthFilter && healthFilter !== 'ALL') {
            result = result.filter(b => b.health === healthFilter);
        }

        // 5. ASSIGNEE FILTER
        if (assigneeFilter === '__unassigned__') {
            result = result.filter(b => !b.assignedEngineer);
        } else if (assigneeFilter && assigneeFilter !== 'ALL') {
            result = result.filter(b => (b.assignedEngineer?._id || b.assignedEngineer) === assigneeFilter);
        }

        // 6. SEARCH FILTER
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(b =>
                b.name.toLowerCase().includes(term) ||
                (b.type || '').toLowerCase().includes(term) ||
                b.status.toLowerCase().includes(term) ||
                (b.assignedEngineer?.displayName || '').toLowerCase().includes(term)
            );
        }

        // 7. DETERMINISTIC SORTING
        result.sort((a, b) => {
            // First: Escalation & Bottleneck priority
            const prioA = (a.priority === 'CRITICAL' ? 3 : a.priority === 'HIGH' ? 2 : 1) + (a.isBottleneck ? 10 : 0);
            const prioB = (b.priority === 'CRITICAL' ? 3 : b.priority === 'HIGH' ? 2 : 1) + (b.isBottleneck ? 10 : 0);
            if (prioB !== prioA) return prioB - prioA;

            // Second: User selected sort
            let valA = a[sortField], valB = b[sortField];
            if (sortField === 'status') { 
                const stages = Object.keys(STAGES);
                valA = stages.indexOf(a.status); 
                valB = stages.indexOf(b.status); 
            } else if (sortField === 'health') { 
                const o = { 'BOTTLENECK': 0, 'CRITICAL': 1, 'HEALTHY': 2 }; 
                valA = o[a.health] ?? 3; 
                valB = o[b.health] ?? 3; 
            } else if (sortField === 'estimatedHours') { 
                valA = a.estimatedHours || 0; valB = b.estimatedHours || 0; 
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [blocks, quickView, stageFilter, healthFilter, assigneeFilter, searchTerm, sortField, sortOrder]);

    const toggleSelect = useCallback((id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(prev => prev.length === filteredBlocks.length ? [] : filteredBlocks.map(b => b._id));
    }, [filteredBlocks]);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        onCreateBlock({ 
            ...formData, 
            baseHours: Number(formData.baseHours),
            estimatedArea: Number(formData.estimatedArea),
            priority: Number(formData.priority)
        });
        setFormData({ 
            name: '', type: BLOCK_TYPES[0], description: '', techNode: TECH_NODES[TECH_NODES.length - 1], 
            complexity: 'SIMPLE', baseHours: 0, estimatedArea: 0, priority: 1, dependencies: [], assignedEngineer: '' 
        });
        setShowForm(false);
    }, [formData, onCreateBlock, setShowForm]);

    const handleBulkAction = useCallback(async (action, payload) => {
        if (selectedIds.length === 0) return;
        
        for (const id of selectedIds) {
            const block = blocks.find(b => b._id === id);
            if (!block) continue;
            
            switch (action) {
                case 'APPROVE':
                    if (onReview) await onReview(block._id, 'APPROVE');
                    break;
                case 'REJECT':
                    if (onReview) await onReview(block._id, 'REJECT', 'Bulk rejected by manager');
                    break;
                case 'ESCALATE':
                    if (onEscalate) await onEscalate(block._id);
                    break;
                case 'ASSIGN':
                    if (onAssign && payload?.engineerId) await onAssign(block._id, payload.engineerId);
                    break;
            }
        }
        
        setSelectedIds([]);
    }, [selectedIds, blocks, onReview, onAssign, onEscalate]);

    return (
        <div style={{ padding: '24px 24px 32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <WorkspaceHeader 
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                healthFilter={healthFilter}
                stageFilter={stageFilter}
                setFilter={setFilter}
                clearFilters={clearFilters}
                onCreateBlock={() => setShowForm(true)}
                onLoadDemo={onLoadDemo}
                onResetDataset={onResetDataset}
                viewMode={viewMode}
                setViewMode={setViewMode}
                isManager={isManager}
            />
                <WorkflowBanner blocks={blocks} analytics={analytics} engineers={engineers} />
                <KpiStrip blocks={blocks} analytics={analytics} engineers={engineers} />

                {/* Create Block Form */}
                {showForm && (
                    <div style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}>
                        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Create New Layout Block</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Block Name *</label>
                                    <input className="form-control" style={{ fontSize: 12.5, padding: '7px 10px' }} required placeholder="e.g. Bandgap_Ref" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Block Type</label>
                                    <select className="form-control" style={{ fontSize: 12.5, padding: '7px 10px' }} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        {BLOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Tech Node</label>
                                    <select className="form-control" style={{ fontSize: 12.5, padding: '7px 10px' }} value={formData.techNode} onChange={e => setFormData({ ...formData, techNode: e.target.value })}>
                                        {TECH_NODES.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Complexity</label>
                                    <select className="form-control" style={{ fontSize: 12.5, padding: '7px 10px' }} value={formData.complexity} onChange={e => setFormData({ ...formData, complexity: e.target.value })}>
                                        {COMPLEXITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Base Effort (Hrs) *</label>
                                    <input type="number" className="form-control" style={{ fontSize: 12.5, padding: '7px 10px' }} required placeholder="0" value={formData.baseHours} onChange={e => setFormData({ ...formData, baseHours: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Estimated Area (µm²)</label>
                                    <input type="number" className="form-control" style={{ fontSize: 12.5, padding: '7px 10px' }} placeholder="0" value={formData.estimatedArea} onChange={e => setFormData({ ...formData, estimatedArea: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Priority (1-10)</label>
                                    <input type="number" min="1" max="10" className="form-control" style={{ fontSize: 12.5, padding: '7px 10px' }} value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Assignee</label>
                                    <select className="form-control" style={{ fontSize: 12.5, padding: '7px 10px' }} value={formData.assignedEngineer} onChange={e => setFormData({ ...formData, assignedEngineer: e.target.value })}>

                                        <option value="">Unassigned</option>
                                        {engineers.map(eng => <option key={eng._id} value={eng._id}>{eng.displayName}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Dependencies</label>
                                    <select 
                                        multiple 
                                        className="form-control" 
                                        style={{ fontSize: 12.5, padding: '7px 10px', height: 80 }} 
                                        value={formData.dependencies} 
                                        onChange={e => setFormData({ ...formData, dependencies: Array.from(e.target.selectedOptions, option => option.value) })}
                                    >
                                        {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                                    </select>
                                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>Hold Ctrl/Cmd to select multiple dependencies</div>
                                </div>
                                <div style={{ gridColumn: 'span 3' }}>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Description</label>
                                    <textarea className="form-control" style={{ fontSize: 12.5, padding: '7px 10px', minHeight: 60 }} placeholder="Technical specifications and constraints..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                                <button type="submit" className="btn btn-sm btn-primary">Create Block</button>
                                <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                <WorkspaceToolbar
                    searchTerm={searchTerm} onSearchChange={setSearchTerm}
                    stageFilter={stageFilter} onStageFilterChange={setStageFilter}
                    healthFilter={healthFilter} onHealthFilterChange={setHealthFilter}
                    assigneeFilter={assigneeFilter} onAssigneeFilterChange={setAssigneeFilter}
                    quickView={quickView} onQuickViewChange={setQuickView}
                    engineers={engineers}
                />

                <BulkActionsBar 
                    selectedBlocks={blocks.filter(b => selectedIds.includes(b._id))}
                    allBlocks={blocks}
                    engineers={engineers}
                    onClear={() => setSelectedIds([])} 
                    onAction={handleBulkAction}
                />

                <WorkflowTable
                    blocks={filteredBlocks}
                    allBlocks={blocks}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onSelectAll={selectAll}
                    expandedId={expandedId}
                    onToggleExpand={id => setExpandedId(prev => prev === id ? null : id)}
                    onOpenDrawer={(block, reject = false) => {
                        setDrawerBlock(block);
                        setDrawerRejectMode(reject);
                    }}
                    onAssign={onAssign}
                    onReview={onReview}
                    onStatusUpdate={onUpdateStatus}
                    onEscalate={onEscalate}
                    engineers={engineers}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                />

            {drawerBlock && (
                <BlockDetailsDrawer
                    block={drawerBlock}
                    engineers={engineers}
                    onAssign={onAssign}
                    onReview={onReview}
                    onUpdateStatus={onUpdateStatus}
                    onEscalate={onEscalate}
                    startWithRejection={drawerRejectMode}
                    isManager={isManager}
                    onClose={() => { setDrawerBlock(null); setDrawerRejectMode(false); }}
                />
            )}

        </div>
    );
};

export default WorkspaceTab;
