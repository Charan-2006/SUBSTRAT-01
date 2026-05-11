import React, { useState, useMemo, useRef } from 'react';
import { Layers, Zap, Info, MoreHorizontal, Filter, Search, Grid, List, Map, Download, Upload, Trash2, Database, AlertCircle, Plus, X, FileText, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { useOrchestration } from '../../context/OrchestrationContext';

// --- EXPORT UTILS ---
function blocksToCSV(blocks, mode) {
    let data = blocks;
    if (mode === 'critical') data = blocks.filter(b => b.healthStatus === 'CRITICAL');
    else if (mode === 'engineers') {
        const rows = [];
        const engMap = {};
        blocks.forEach(b => {
            const eng = b.assignedEngineer?.displayName || 'Unassigned';
            if (!engMap[eng]) engMap[eng] = { active: 0, critical: 0, completed: 0 };
            if (b.status === 'COMPLETED') engMap[eng].completed++;
            else if (b.healthStatus === 'CRITICAL') { engMap[eng].active++; engMap[eng].critical++; }
            else engMap[eng].active++;
        });
        const header = 'Engineer,Active Blocks,Critical,Completed\n';
        return header + Object.entries(engMap).map(([n, d]) => `"${n}",${d.active},${d.critical},${d.completed}`).join('\n');
    }

    const header = 'Name,Type,Status,Health,Complexity,Assignee,Progress%,Rejections,Dependencies,Created,Updated\n';
    const rows = data.map(b => {
        const deps = (b.dependencies || []).map(d => d.name || '').join('; ');
        const created = b.createdAt ? new Date(b.createdAt).toISOString() : '';
        const updated = b.updatedAt ? new Date(b.updatedAt).toISOString() : '';
        return `"${b.name}","${b.type || ''}","${b.status}","${b.healthStatus}","${b.complexity || 'SIMPLE'}","${b.assignedEngineer?.displayName || ''}",${b.progress || 0},${b.rejectionCount || 0},"${deps}","${created}","${updated}"`;
    });
    return header + rows.join('\n');
}

function blocksToJSON(blocks, mode) {
    let data = blocks;
    if (mode === 'critical') data = blocks.filter(b => b.healthStatus === 'CRITICAL');
    const exported = data.map(b => ({
        name: b.name, type: b.type, status: b.status, healthStatus: b.healthStatus,
        complexity: b.complexity, progress: b.progress, rejectionCount: b.rejectionCount || 0,
        assignee: b.assignedEngineer?.displayName || null,
        dependencies: (b.dependencies || []).map(d => ({ name: d.name, status: d.status, health: d.healthStatus })),
        stageHistory: b.stageHistory || [],
        createdAt: b.createdAt, updatedAt: b.updatedAt,
    }));
    return JSON.stringify({ exportedAt: new Date().toISOString(), count: exported.length, mode, blocks: exported }, null, 2);
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

// --- IMPORT VALIDATION ---
const VALID_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
const VALID_HEALTH = ['HEALTHY', 'RISK', 'CRITICAL'];
const VALID_COMPLEXITY = ['SIMPLE', 'MEDIUM', 'COMPLEX'];

function validateImportRow(row, idx, existingNames) {
    const errors = [];
    if (!row.name || typeof row.name !== 'string' || !row.name.trim()) errors.push(`Row ${idx + 1}: Missing block name`);
    else if (existingNames.has(row.name.trim().toLowerCase())) errors.push(`Row ${idx + 1}: "${row.name}" already exists`);
    if (row.status && !VALID_STATUSES.includes(row.status.toUpperCase())) errors.push(`Row ${idx + 1}: Invalid status "${row.status}"`);
    if (row.healthStatus && !VALID_HEALTH.includes(row.healthStatus.toUpperCase())) errors.push(`Row ${idx + 1}: Invalid health "${row.healthStatus}"`);
    if (row.complexity && !VALID_COMPLEXITY.includes(row.complexity.toUpperCase())) errors.push(`Row ${idx + 1}: Invalid complexity "${row.complexity}"`);
    return errors;
}

function parseCSVImport(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return { rows: [], errors: ['CSV must have a header row and at least one data row'] };
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h === 'name');
    if (nameIdx < 0) return { rows: [], errors: ['CSV must have a "Name" column'] };
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].match(/("([^"]*)")|([^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
        const row = {};
        headers.forEach((h, j) => { if (vals[j] !== undefined) row[h] = vals[j]; });
        rows.push({ name: row.name || '', type: row.type || '', status: (row.status || 'NOT_STARTED').toUpperCase(), healthStatus: (row.health || row.healthstatus || 'HEALTHY').toUpperCase(), complexity: (row.complexity || 'SIMPLE').toUpperCase(), baseHours: parseInt(row.basehours || row['base hours'] || '0') || 0, description: row.description || '' });
    }
    return { rows, errors: [] };
}

function parseJSONImport(text) {
    try {
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : data.blocks || [];
        if (!arr.length) return { rows: [], errors: ['No blocks found in JSON'] };
        const rows = arr.map(b => ({ name: b.name || '', type: b.type || '', status: (b.status || 'NOT_STARTED').toUpperCase(), healthStatus: (b.healthStatus || 'HEALTHY').toUpperCase(), complexity: (b.complexity || 'SIMPLE').toUpperCase(), baseHours: b.baseHours || b.estimatedHours || 0, description: b.description || '' }));
        return { rows, errors: [] };
    } catch (e) { return { rows: [], errors: [`Invalid JSON: ${e.message}`] }; }
}

// --- MODAL STYLES ---
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' };
const modal = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px', width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' };
const label = { fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 };
const selectStyle = { width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '8px 20px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' };
const btnSecondary = { padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' };
const tag = (bg, fg) => ({ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: bg, color: fg, textTransform: 'uppercase' });

const WorkspaceHeader = ({
    searchTerm,
    onSearchChange,
    healthFilter,
    stageFilter,
    setFilter,
    clearFilters,
    onCreateBlock,
    onLoadDemo,
    onResetDataset,
    viewMode,
    setViewMode,
    isManager
}) => {
    const { blocks, kpis, importBlocks } = useOrchestration();
    const [showExport, setShowExport] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [exportMode, setExportMode] = useState('all');
    const [exportFormat, setExportFormat] = useState('csv');
    const [exportDone, setExportDone] = useState(false);

    const [importFile, setImportFile] = useState(null);
    const [importParsed, setImportParsed] = useState(null);
    const [importErrors, setImportErrors] = useState([]);
    const [importStep, setImportStep] = useState('upload'); // upload | preview | done
    const [importing, setImporting] = useState(false);
    const fileRef = useRef();

    const active = kpis.active;
    const bottlenecked = kpis.trueBottlenecks;
    const depEscalations = blocks.filter(b => b.allUpstream?.some(u => u.health === 'CRITICAL' || u.health === 'SEVERE')).length;
    const summaryParts = [`${blocks.length} workflow block${blocks.length !== 1 ? 's' : ''}`];
    if (active > 0) summaryParts.push(`${active} in execution`);
    if (bottlenecked > 0) summaryParts.push(`${bottlenecked} bottlenecked`);
    if (depEscalations > 0) summaryParts.push(`${depEscalations} dependency escalation${depEscalations !== 1 ? 's' : ''}`);

    const exportCount = useMemo(() => {
        if (exportMode === 'critical') return blocks.filter(b => b.healthStatus === 'CRITICAL').length;
        if (exportMode === 'engineers') return new Set(blocks.map(b => b.assignedEngineer?.displayName || 'Unassigned')).size;
        return blocks.length;
    }, [blocks, exportMode]);

    const handleExport = () => {
        const ts = new Date().toISOString().slice(0, 10);
        if (exportFormat === 'csv') {
            downloadFile(blocksToCSV(blocks, exportMode), `substrat-${exportMode}-${ts}.csv`, 'text/csv');
        } else {
            downloadFile(blocksToJSON(blocks, exportMode), `substrat-${exportMode}-${ts}.json`, 'application/json');
        }
        setExportDone(true);
        setTimeout(() => { setExportDone(false); setShowExport(false); }, 1500);
    };

    const handleFileSelect = (file) => {
        if (!file) return;
        setImportFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const isJSON = file.name.endsWith('.json');
            const { rows, errors: parseErrors } = isJSON ? parseJSONImport(text) : parseCSVImport(text);
            if (parseErrors.length) { setImportErrors(parseErrors); setImportParsed(null); return; }
            const existingNames = new Set(blocks.map(b => b.name.trim().toLowerCase()));
            const allErrors = [];
            rows.forEach((r, i) => { allErrors.push(...validateImportRow(r, i, existingNames)); });
            setImportParsed(rows);
            setImportErrors(allErrors);
            setImportStep('preview');
        };
        reader.readAsText(file);
    };

    const handleImportConfirm = async () => {
        if (!importParsed || importErrors.length > 0) return;
        setImporting(true);
        try {
            if (importBlocks) {
                await importBlocks(importParsed);
            }
            setImportStep('done');
        } catch (err) {
            setImportErrors([`Import failed: ${err.message}`]);
        } finally {
            setImporting(false);
        }
    };

    const resetImport = () => { setImportFile(null); setImportParsed(null); setImportErrors([]); setImportStep('upload'); setShowImport(false); };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Operations Workspace</h2>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', marginTop: 4 }}>{summaryParts.join(' • ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-sm" style={{ color: 'var(--text-tertiary)', gap: 4 }} onClick={() => setShowExport(true)}><Download size={14} /> Export</button>
                    <button className="btn btn-sm" style={{ color: 'var(--text-tertiary)', gap: 4 }} onClick={() => setShowImport(true)}><Upload size={14} /> Import</button>
                    <button className="btn btn-sm btn-primary" style={{ gap: 4 }} onClick={onCreateBlock}><Plus size={14} /> Create Block</button>
                </div>
            </div>

            {/* EXPORT MODAL */}
            {showExport && (
                <div style={overlay} onClick={() => setShowExport(false)}>
                    <div style={modal} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Export Workflow Data</h3>
                            <button onClick={() => setShowExport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={16} /></button>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                            <span style={label}>Export Type</span>
                            <select style={selectStyle} value={exportMode} onChange={e => setExportMode(e.target.value)}>
                                <option value="all">All Workflows</option>
                                <option value="critical">Critical Blocks Only</option>
                                <option value="engineers">Engineer Allocation</option>
                            </select>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <span style={label}>File Format</span>
                            <select style={selectStyle} value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
                                <option value="csv">CSV (.csv)</option>
                                <option value="json">JSON (.json)</option>
                            </select>
                        </div>

                        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Export Preview</div>
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{exportCount}</div><div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Records</div></div>
                                <div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>.{exportFormat}</div><div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Format</div></div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button style={btnSecondary} onClick={() => setShowExport(false)}>Cancel</button>
                            <button style={btnPrimary} onClick={handleExport} disabled={exportDone}>
                                {exportDone ? <><CheckCircle2 size={13} /> Exported!</> : <><Download size={13} /> Export {exportCount} Records</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT MODAL */}
            {showImport && (
                <div style={overlay} onClick={resetImport}>
                    <div style={{ ...modal, width: 580 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Import Workflows</h3>
                            <button onClick={resetImport} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={16} /></button>
                        </div>

                        {importStep === 'upload' && (
                            <>
                                <div
                                    style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s', background: 'var(--bg)' }}
                                    onClick={() => fileRef.current?.click()}
                                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                    onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; handleFileSelect(e.dataTransfer.files[0]); }}
                                >
                                    <Upload size={24} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Drop file here or click to browse</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Supports .csv and .json • Max 500 rows</div>
                                    <input ref={fileRef} type="file" accept=".csv,.json" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
                                </div>
                                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>CSV Template</div>
                                    <code style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', lineHeight: 1.5 }}>Name,Type,Status,Health,Complexity,Base Hours,Description</code>
                                    <button style={{ ...btnSecondary, marginTop: 6, fontSize: 10, padding: '4px 10px' }} onClick={() => downloadFile('Name,Type,Status,Health,Complexity,Base Hours,Description\nExample_Block,Analog Core,NOT_STARTED,HEALTHY,SIMPLE,10,Example block', 'import-template.csv', 'text/csv')}><Download size={10} /> Download Template</button>
                                </div>
                            </>
                        )}

                        {importStep === 'preview' && importParsed && (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                    <span style={tag('var(--accent-subtle)', 'var(--accent)')}>{importParsed.length} blocks</span>
                                    <span style={tag(importErrors.length ? 'var(--red-bg)' : 'var(--green-bg)', importErrors.length ? 'var(--red-text)' : 'var(--green-text)')}>{importErrors.length ? `${importErrors.length} errors` : 'Valid'}</span>
                                    <span style={tag('var(--bg)', 'var(--text-tertiary)')}>{importFile?.name}</span>
                                </div>

                                {importErrors.length > 0 && (
                                    <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, maxHeight: 120, overflowY: 'auto' }}>
                                        {importErrors.map((e, i) => <div key={i} style={{ fontSize: 11, color: 'var(--red-text)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={10} /> {e}</div>)}
                                    </div>
                                )}

                                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12, maxHeight: 240, overflowY: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg)' }}>
                                                {['Name', 'Type', 'Status', 'Health', 'Complexity'].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-light)' }}>{h}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importParsed.slice(0, 20).map((r, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                                                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{r.type || '—'}</td>
                                                    <td style={{ padding: '5px 8px' }}><span style={tag('var(--bg)', 'var(--text-secondary)')}>{r.status}</span></td>
                                                    <td style={{ padding: '5px 8px' }}><span style={tag(r.healthStatus === 'CRITICAL' ? 'var(--red-bg)' : r.healthStatus === 'RISK' ? 'var(--amber-bg)' : 'var(--green-bg)', r.healthStatus === 'CRITICAL' ? 'var(--red-text)' : r.healthStatus === 'RISK' ? 'var(--amber-text)' : 'var(--green-text)')}>{r.healthStatus}</span></td>
                                                    <td style={{ padding: '5px 8px', color: 'var(--text-tertiary)' }}>{r.complexity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {importParsed.length > 20 && <div style={{ padding: 8, fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>...and {importParsed.length - 20} more</div>}
                                </div>

                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button style={btnSecondary} onClick={() => { setImportStep('upload'); setImportParsed(null); setImportErrors([]); }}>Back</button>
                                    <button style={{ ...btnPrimary, opacity: importErrors.length ? 0.5 : 1 }} onClick={handleImportConfirm} disabled={importErrors.length > 0 || importing}>
                                        {importing ? 'Importing...' : <><Upload size={13} /> Import {importParsed.length} Blocks</>}
                                    </button>
                                </div>
                            </>
                        )}

                        {importStep === 'done' && (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <CheckCircle2 size={32} style={{ color: 'var(--green)', marginBottom: 8 }} />
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Import Complete</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{importParsed?.length || 0} blocks imported successfully.</div>
                                <button style={btnPrimary} onClick={resetImport}>Done</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default WorkspaceHeader;
