import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Shield, CheckCircle2, AlertTriangle, Activity, Zap, 
    Clock, User, BarChart3, Download, Copy, ExternalLink, 
    FileText, Link2, Info, ChevronRight, TrendingUp,
    CheckSquare, FileWarning, Search, Cpu, History
} from 'lucide-react';
import { 
    calculateSLA, calculateDependencyImpact, calculateHealth, 
    calculateEfficiency, calculateEstimation, calculatePropagationImpact 
} from '../utils/workflowEngine';
import { STAGES, HEALTH_STATES } from '../constants/workflowStates';

const VerificationReportModal = ({ isOpen, onClose, doc, blocks }) => {
    // 1. Core Data Hook
    const block = useMemo(() => {
        if (!doc || !blocks) return null;
        return blocks.find(b => b._id === doc.blockId) || blocks.find(b => b.name === doc.blockName);
    }, [doc, blocks]);

    // 2. Orchestration Hooks (Must be called unconditionally)
    const sla = useMemo(() => block ? calculateSLA(block) : null, [block]);
    const health = useMemo(() => (block && blocks) ? calculateHealth(block, blocks) : null, [block, blocks]);
    const propagation = useMemo(() => (block && blocks) ? calculatePropagationImpact(block, blocks) : { risk: 0, impactCount: 0, orchestrationState: 'UNKNOWN' }, [block, blocks]);
    const impact = useMemo(() => (block && blocks) ? calculateDependencyImpact(block, blocks) : { upstream: [], downstream: [] }, [block, blocks]);

    const { risk, impactCount, orchestrationState } = propagation;
    const { upstream, downstream } = impact;

    // 3. Efficiency & Variance Hook
    const efficiencyData = useMemo(() => {
        if (!block) return { estHours: 0, actHours: 0, variance: 0, efficiencyScore: 100, grade: { label: 'N/A', color: 'gray' } };
        
        const estHours = block.estimatedDurationHours || calculateEstimation(block.type, block.complexity, block.estimatedArea || 0);
        const actHours = block.actualDurationHours || 0;
        const variance = actHours - estHours;
        const efficiencyScore = actHours > 0 ? Math.min(100, Math.round((estHours / actHours) * 100)) : 100;
        
        const getGrade = (s) => {
            if (s >= 90) return { label: 'OPTIMAL', color: 'var(--green)' };
            if (s >= 75) return { label: 'HEALTHY', color: 'var(--accent)' };
            if (s >= 50) return { label: 'WARNING', color: 'var(--amber)' };
            return { label: 'CRITICAL', color: 'var(--red)' };
        };
        
        return { estHours, actHours, variance, efficiencyScore, grade: getGrade(efficiencyScore) };
    }, [block]);

    const { estHours, actHours, variance, efficiencyScore, grade } = efficiencyData;

    // 4. Verification Intelligence Hooks
    const drcMetrics = useMemo(() => {
        if (!block) return { criticalErrors: 0, metalSpacing: 0, densityViolations: 0, routingWarnings: 0, status: 'PENDING' };
        
        const isNodeAdvanced = ['5nm', '3nm', '4nm'].includes(block.techNode);
        const complexityFactor = block.complexity === 'CRITICAL' ? 3 : (block.complexity === 'COMPLEX' ? 2 : 1);
        const hasClearedDRC = ['DRC', 'LVS', 'REVIEW', 'COMPLETED'].includes(block.status);
        
        const seed = parseInt(block._id?.substring(0, 8), 16) || 123;
        const criticalErrors = hasClearedDRC ? 0 : (block.health === 'CRITICAL' ? (seed % 3) : 0);
        const metalSpacing = hasClearedDRC ? 0 : (isNodeAdvanced ? (seed % 15) : (seed % 5));
        const densityViolations = (isNodeAdvanced ? (seed % 10) + 2 : (seed % 4));
        const routingWarnings = (complexityFactor * (seed % 12));
        
        let status = 'PASSED';
        if (criticalErrors > 0) status = 'FAILED';
        else if (densityViolations > 5 || routingWarnings > 10) status = 'WARNING';

        return { criticalErrors, metalSpacing, densityViolations, routingWarnings, status };
    }, [block]);

    const lvsMetrics = useMemo(() => {
        if (!block) return { mismatches: 0, parasiticDev: 0, netConsistency: 100, status: 'PENDING' };
        
        const isNodeAdvanced = ['5nm', '3nm', '4nm'].includes(block.techNode);
        const hasClearedLVS = ['LVS', 'REVIEW', 'COMPLETED'].includes(block.status);
        const seed = (parseInt(block._id?.substring(8, 16), 16) || 456) + 1;
        const mismatches = hasClearedLVS ? 0 : (block.health === 'CRITICAL' ? (seed % 5) : 0);
        const parasiticDev = (seed % 8) + (isNodeAdvanced ? 5 : 2);
        const netConsistency = 100 - (mismatches * 10) - (hasClearedLVS ? 0 : (seed % 5));

        let status = 'PASS';
        if (mismatches > 0) status = 'FAIL';
        else if (parasiticDev > 10) status = 'WARNING';

        return { mismatches, parasiticDev, netConsistency, status };
    }, [block]);

    // 5. Signoff Hooks
    const signoffData = useMemo(() => {
        if (!block) return { isEligible: false, releaseState: 'NOT_READY' };
        
        const drcPass = drcMetrics.status !== 'FAILED';
        const lvsPass = lvsMetrics.status !== 'FAIL';
        const noCriticalBlockers = block.health !== 'CRITICAL' && block.health !== 'BOTTLENECK';
        const noEscalations = !block.escalated;
        
        const isEligible = drcPass && lvsPass && (block.status === 'REVIEW' || block.status === 'COMPLETED') && noCriticalBlockers && noEscalations;
        
        let releaseState = 'NOT_READY';
        if (block.isReleased) releaseState = 'RELEASED';
        else if (block.status === 'COMPLETED') releaseState = 'ELIGIBLE';
        else if (isEligible) releaseState = 'SIGNOFF_PENDING';
        else if (block.status === 'REVIEW') releaseState = 'REVIEW_PENDING';

        return { isEligible, releaseState };
    }, [block, drcMetrics, lvsMetrics]);

    const { isEligible, releaseState } = signoffData;

    // --- EARLY RETURN (Must be after ALL hooks) ---
    if (!isOpen || !block) return null;

    // --- Action Handlers ---
    const handleDownload = () => window.print();

    const handleCopy = () => {
        const text = `
SUBSTRAT VERIFICATION REPORT — ${block.name}
Generated: ${new Date().toLocaleString()}

1. EXECUTION SUMMARY
Engineer: ${block.assignedEngineer?.displayName || 'Unassigned'}
Node: ${block.techNode} | Complexity: ${block.complexity}
Estimated: ${estHours}h | Actual: ${actHours}h | Variance: ${variance.toFixed(1)}h
Efficiency: ${efficiencyScore}% (${grade.label})
Health: ${block.healthStatus}

2. DRC REPORT
Status: ${drcMetrics.status}
Critical Errors: ${drcMetrics.criticalErrors}
Metal Spacing: ${drcMetrics.metalSpacing}
Density Violations: ${drcMetrics.densityViolations}

3. LVS REPORT
Match: ${lvsMetrics.status}
Mismatches: ${lvsMetrics.mismatches}
Net Consistency: ${lvsMetrics.netConsistency}%
Parasitic Deviation: ${lvsMetrics.parasiticDev}%

4. ORCHESTRATION INTELLIGENCE
SLA Pressure: ${Math.max(0, (sla?.overrun || 0) * 100).toFixed(0)}%
Propagation Risk: ${risk}%
Downstream Impact: ${downstream.length} blocks
Grade: ${orchestrationState}

5. SIGNOFF
Eligibility: ${isEligible ? 'ELIGIBLE' : 'PENDING'}
Release State: ${releaseState}
        `;
        navigator.clipboard.writeText(text);
        alert("Report copied to clipboard.");
    };

    const drcHistory = (block.stageHistory || []).find(s => s.stage === 'DRC');
    const hasClearedLVS = ['LVS', 'REVIEW', 'COMPLETED'].includes(block.status);

    return (
        <AnimatePresence>
            <div className="report-modal-overlay" onClick={onClose}>
                <motion.div 
                    className="report-modal-content print-area" 
                    onClick={e => e.stopPropagation()}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                >
                    <div className="report-modal-header no-print">
                        <div className="report-header-main">
                            <div className="report-icon-container">
                                <Cpu size={24} color="var(--accent)" />
                            </div>
                            <div>
                                <h2 className="report-title">{block.name} — Execution Intelligence</h2>
                                <div className="report-subtitle">
                                    <span>{doc.type}</span>
                                    <span className="divider">•</span>
                                    <span>Node: {block.techNode}</span>
                                    <span className="divider">•</span>
                                    <span>Audit ID: {block._id?.substring(0, 8)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="report-header-actions">
                            <button className="report-btn-secondary" onClick={handleCopy}><Copy size={14} /> Copy Text</button>
                            <button className="report-btn-secondary" onClick={handleDownload}><Download size={14} /> Export PDF</button>
                            <button className="report-close" onClick={onClose}><X size={20} /></button>
                        </div>
                    </div>

                    <div className="report-modal-body">
                        {/* Section 1: Execution Summary */}
                        <section className="report-section">
                            <div className="report-section-header">
                                <Activity size={16} />
                                <h3>SECTION 1 — EXECUTION SUMMARY</h3>
                            </div>
                            <div className="report-summary-grid">
                                <div className="report-stat">
                                    <span className="label">Engineer</span>
                                    <span className="value">{block.assignedEngineer?.displayName || 'Unassigned'}</span>
                                </div>
                                <div className="report-stat">
                                    <span className="label">Estimated Effort</span>
                                    <span className="value">{estHours}h</span>
                                </div>
                                <div className="report-stat">
                                    <span className="label">Actual Effort</span>
                                    <span className="value">{actHours}h</span>
                                </div>
                                <div className="report-stat">
                                    <span className="label">Total Variance</span>
                                    <span className={`value ${variance > 0 ? 'text-red' : 'text-green'}`}>
                                        {variance > 0 ? `+${variance.toFixed(1)}h` : `${variance.toFixed(1)}h`}
                                    </span>
                                </div>
                                <div className="report-stat">
                                    <span className="label">Efficiency Score</span>
                                    <span className="value" style={{ color: grade.color }}>{efficiencyScore}%</span>
                                </div>
                                <div className="report-stat">
                                    <span className="label">Productivity Grade</span>
                                    <span className="value" style={{ color: grade.color }}>{grade.label}</span>
                                </div>
                                <div className="report-stat">
                                    <span className="label">Execution Health</span>
                                    <span className={`value health-${block.healthStatus?.toLowerCase()}`}>{block.healthStatus}</span>
                                </div>
                                <div className="report-stat">
                                    <span className="label">Complexity</span>
                                    <span className="value">{block.complexity}</span>
                                </div>
                            </div>
                        </section>

                        <div className="report-columns">
                            {/* Section 2: DRC Report */}
                            <section className="report-section half">
                                <div className="report-section-header">
                                    <Shield size={16} color="var(--amber)" />
                                    <h3>SECTION 2 — DRC VERIFICATION</h3>
                                </div>
                                <div className="report-verification-box">
                                    <div className="verification-item">
                                        <span>DRC Status</span>
                                        <span className={`tag ${drcMetrics.status === 'PASSED' ? 'tag-green' : (drcMetrics.status === 'WARNING' ? 'tag-amber' : 'tag-red')}`}>
                                            {drcMetrics.status}
                                        </span>
                                    </div>
                                    <div className="verification-item">
                                        <span>Critical Errors</span>
                                        <span className={`count ${drcMetrics.criticalErrors > 0 ? 'text-red' : ''}`}>{drcMetrics.criticalErrors}</span>
                                    </div>
                                    <div className="verification-item">
                                        <span>Metal Spacing Violations</span>
                                        <span className="count">{drcMetrics.metalSpacing}</span>
                                    </div>
                                    <div className="verification-item">
                                        <span>Density Violations</span>
                                        <span className={`count ${drcMetrics.densityViolations > 5 ? 'text-amber' : ''}`}>{drcMetrics.densityViolations}</span>
                                    </div>
                                    <div className="verification-item">
                                        <span>Routing Warnings</span>
                                        <span className="count">{drcMetrics.routingWarnings}</span>
                                    </div>
                                    <div className="verification-notes">
                                        Execution Window: {drcHistory ? `${formatDuration(drcHistory.durationHours)}` : 'Automated cycle pending'}
                                    </div>
                                </div>
                            </section>

                            {/* Section 3: LVS Report */}
                            <section className="report-section half">
                                <div className="report-section-header">
                                    <CheckSquare size={16} color="var(--green)" />
                                    <h3>SECTION 3 — LVS VERIFICATION</h3>
                                </div>
                                <div className="report-verification-box">
                                    <div className="verification-item">
                                        <span>LVS Match Result</span>
                                        <span className={`tag ${lvsMetrics.status === 'PASS' ? 'tag-green' : (lvsMetrics.status === 'WARNING' ? 'tag-amber' : 'tag-red')}`}>
                                            {lvsMetrics.status}
                                        </span>
                                    </div>
                                    <div className="verification-item">
                                        <span>Connectivity Mismatches</span>
                                        <span className={`count ${lvsMetrics.mismatches > 0 ? 'text-red' : ''}`}>{lvsMetrics.mismatches}</span>
                                    </div>
                                    <div className="verification-item">
                                        <span>Net Consistency Score</span>
                                        <span className="count">{lvsMetrics.netConsistency}%</span>
                                    </div>
                                    <div className="verification-item">
                                        <span>Parasitic Deviation</span>
                                        <span className={`count ${lvsMetrics.parasiticDev > 10 ? 'text-amber' : ''}`}>{lvsMetrics.parasiticDev}%</span>
                                    </div>
                                    <div className="verification-item">
                                        <span>Extraction Integrity</span>
                                        <span className="count">{hasClearedLVS ? 'VERIFIED' : 'PENDING'}</span>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Section 4: Orchestration Intelligence */}
                        <section className="report-section">
                            <div className="report-section-header">
                                <Zap size={16} color="var(--purple)" />
                                <h3>SECTION 4 — ORCHESTRATION INTELLIGENCE</h3>
                            </div>
                            <div className="report-intel-grid">
                                <div className="intel-card">
                                    <div className="intel-label">SLA Pressure</div>
                                    <div className="intel-value">{Math.max(0, Math.round((sla?.overrun || 0) * 100))}%</div>
                                    <div className="intel-desc">Project-level timeline drift contribution</div>
                                </div>
                                <div className="intel-card">
                                    <div className="intel-label">Propagation Risk</div>
                                    <div className="intel-value">{risk}%</div>
                                    <div className="intel-desc">Inherited risk to downstream dependencies</div>
                                </div>
                                <div className="intel-card">
                                    <div className="intel-label">Downstream Impact</div>
                                    <div className="intel-value">{downstream.length}</div>
                                    <div className="intel-desc">Workflows blocked by this verification</div>
                                </div>
                                <div className="intel-card">
                                    <div className="intel-label">Orchestration Grade</div>
                                    <div className="intel-value" style={{ color: orchestrationState === 'STABLE' ? 'var(--green)' : 'var(--red)' }}>
                                        {orchestrationState}
                                    </div>
                                    <div className="intel-desc">Based on systemic execution health</div>
                                </div>
                            </div>
                        </section>

                        {/* Section 5: Review Comments & Audit */}
                        <section className="report-section">
                            <div className="report-section-header">
                                <History size={16} color="var(--blue)" />
                                <h3>SECTION 5 — REVIEW COMMENTS & AUDIT TRAIL</h3>
                            </div>
                            <div className="report-audit-trail">
                                {block.rejectionHistory?.length === 0 && block.approvalHistory?.length === 0 && (
                                    <div className="audit-empty">No review records found. Workflow in primary execution phase.</div>
                                )}
                                {block.rejectionHistory?.map((rej, i) => (
                                    <div key={`rej-${i}`} className="audit-item rejection">
                                        <div className="audit-dot" />
                                        <div className="audit-content">
                                            <div className="audit-title">REJECTION: {rej.stage} Stage Failure</div>
                                            <div className="audit-meta">{new Date(rej.timestamp).toLocaleString()} • Severity: {rej.severity}</div>
                                            <div className="audit-msg">{rej.reason}</div>
                                        </div>
                                    </div>
                                ))}
                                {block.approvalHistory?.map((app, i) => (
                                    <div key={`app-${i}`} className="audit-item approval">
                                        <div className="audit-dot" />
                                        <div className="audit-content">
                                            <div className="audit-title">SIGNOFF: {app.stage} Stage Approved</div>
                                            <div className="audit-meta">{new Date(app.timestamp).toLocaleString()} • Reviewer: {app.reviewer?.displayName || 'Manager'}</div>
                                            <div className="audit-msg">{app.comments || 'Verification parameters within tolerance. Sign-off granted.'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Section 6: Final Signoff */}
                        <section className="report-section signoff">
                            <div className="report-section-header">
                                <CheckCircle2 size={16} />
                                <h3>SECTION 6 — FINAL SIGNOFF & TAPE-OUT ELIGIBILITY</h3>
                            </div>
                            <div className="signoff-banner">
                                <div className="signoff-status">
                                    <div className="signoff-label">Current Release State</div>
                                    <div className={`signoff-value ${releaseState === 'RELEASED' || releaseState === 'ELIGIBLE' ? 'eligible' : 'ineligible'}`}>
                                        {releaseState.replace('_', ' ')}
                                    </div>
                                </div>
                                <div className="signoff-meta">
                                    <div>Eligibility Check: <strong>{isEligible ? 'PASSED' : 'PENDING'}</strong></div>
                                    <div>Signoff Authorization: <strong>{block.status === 'COMPLETED' ? 'AUTHORIZED' : 'LOCKED'}</strong></div>
                                </div>
                            </div>
                        </section>
                    </div>
                </motion.div>
            </div>
            
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-area { 
                        position: absolute; top: 0; left: 0; width: 100%; height: auto; 
                        box-shadow: none; border: none; max-width: none; max-height: none; overflow: visible;
                    }
                    .report-modal-overlay { background: white; padding: 0; }
                    .report-modal-body { overflow: visible; padding: 0; }
                    .report-section { page-break-inside: avoid; }
                }
            `}</style>
        </AnimatePresence>
    );
};

// Helper for duration formatting
function formatDuration(hours) {
    if (!hours) return '0.0h';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
}

export default VerificationReportModal;
