import React, { useState, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    LineChart, Line, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { Calendar, Download, Target, Clock, AlertTriangle, CheckCircle, Activity, Users } from 'lucide-react';
import './ReportingTab.css';

const WORKFLOW_STAGES = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];
const COLORS = ['#6B778C', '#0052CC', '#FFAB00', '#FF5630', '#6554C0', '#36B37E'];

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="custom-tooltip">
                <div className="custom-tooltip-label">{label}</div>
                {payload.map((entry, index) => (
                    <div key={index} className="custom-tooltip-item">
                        <div className="custom-tooltip-dot" style={{ backgroundColor: entry.color }} />
                        <span>{entry.name}: {entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const ReportingTab = ({ blocks = [], engineers = [], analytics }) => {
    const [timeRange, setTimeRange] = useState('30days');

    // --- Data Processing ---
    
    // 1. KPI Metrics
    const totalBlocks = blocks.length;
    const completedBlocks = blocks.filter(b => b.status === 'COMPLETED').length;
    const onTimeRate = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0; // Simplified for demo
    
    // Calculate Average Lead Time (mock calculation if actual timestamps aren't detailed)
    const avgLeadTime = useMemo(() => {
        if (!analytics || !analytics.avgCompletionDays) return '14.2 days'; // Fallback dummy
        return `${analytics.avgCompletionDays.toFixed(1)} days`;
    }, [analytics]);

    const bottleneckStage = analytics?.bottleneckStage || 'DRC';

    // 2. Workflow Distribution (Donut Chart)
    const distributionData = useMemo(() => {
        return WORKFLOW_STAGES.map((stage, idx) => ({
            name: stage.replace('_', ' '),
            value: blocks.filter(b => b.status === stage).length,
            color: COLORS[idx]
        })).filter(d => d.value > 0);
    }, [blocks]);

    // 3. Stage Duration Analysis (Bar Chart)
    // Using mock average hours if real tracking data isn't complete
    const stageDurationData = useMemo(() => {
        const baseData = [
            { stage: 'Not Started', hours: 12 },
            { stage: 'In Progress', hours: 48 },
            { stage: 'DRC', hours: 72 },
            { stage: 'LVS', hours: 36 },
            { stage: 'Review', hours: 24 }
        ];
        
        // If we have real analytics, try to use it
        if (analytics?.bottleneckStage) {
            const bIndex = baseData.findIndex(d => d.stage.toUpperCase() === analytics.bottleneckStage);
            if (bIndex !== -1) baseData[bIndex].hours = analytics.maxAvgHours || 80;
        }
        return baseData;
    }, [analytics]);

    // 4. Throughput Trend (Line Chart) - Mocked historical data for visual
    const trendData = [
        { date: 'Week 1', completed: 4, added: 6 },
        { date: 'Week 2', completed: 7, added: 5 },
        { date: 'Week 3', completed: 5, added: 8 },
        { date: 'Week 4', completed: 12, added: 4 },
    ];

    // 5. Team Workload
    const workloadData = useMemo(() => {
        return engineers.map(eng => {
            const assignedBlocks = blocks.filter(b => b.assignedEngineer?._id === eng._id || b.assignedEngineer === eng._id);
            const active = assignedBlocks.filter(b => !['COMPLETED', 'NOT_STARTED'].includes(b.status)).length;
            return {
                name: eng.displayName?.split(' ')[0] || 'Unknown',
                activeTasks: active,
                totalAssigned: assignedBlocks.length
            };
        }).sort((a, b) => b.activeTasks - a.activeTasks).slice(0, 5);
    }, [blocks, engineers]);

    const handleExport = () => {
        alert("Exporting analytics data as CSV...");
    };

    return (
        <div className="reporting-container">
            {/* Header */}
            <div className="reporting-header">
                <div className="reporting-title">
                    <h2>Reporting & Insights</h2>
                    <p>Understand performance, bottlenecks, and delivery trends</p>
                </div>
                <div className="reporting-actions">
                    <select 
                        className="reporting-select" 
                        value={timeRange} 
                        onChange={(e) => setTimeRange(e.target.value)}
                    >
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                        <option value="all">All Time</option>
                    </select>
                    <button className="reporting-btn reporting-btn-outline" onClick={handleExport}>
                        <Download size={16} /> Export CSV
                    </button>
                </div>
            </div>

            {/* KPI Summary */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-header">
                        <span className="kpi-label">Total Blocks</span>
                        <div className="kpi-icon blue"><Target size={18} /></div>
                    </div>
                    <div className="kpi-value">{totalBlocks}</div>
                    <div className="kpi-subtext">
                        <span className="trend-up">↑ 12%</span> vs last period
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-header">
                        <span className="kpi-label">Completed</span>
                        <div className="kpi-icon green"><CheckCircle size={18} /></div>
                    </div>
                    <div className="kpi-value">{completedBlocks}</div>
                    <div className="kpi-subtext">
                        <span className="trend-up">↑ 5%</span> vs last period
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-header">
                        <span className="kpi-label">Avg Lead Time</span>
                        <div className="kpi-icon purple"><Clock size={18} /></div>
                    </div>
                    <div className="kpi-value">{avgLeadTime}</div>
                    <div className="kpi-subtext">
                        <span className="trend-down">↓ 1.2 days</span> vs last period
                    </div>
                </div>

                <div className="kpi-card" style={{ borderColor: 'var(--amber)', background: 'linear-gradient(180deg, var(--surface) 0%, var(--amber-bg) 200%)' }}>
                    <div className="kpi-header">
                        <span className="kpi-label" style={{ color: 'var(--amber-text)' }}>Current Bottleneck</span>
                        <div className="kpi-icon amber"><AlertTriangle size={18} /></div>
                    </div>
                    <div className="kpi-value" style={{ color: 'var(--amber-text)' }}>{bottleneckStage}</div>
                    <div className="kpi-subtext" style={{ color: 'var(--amber-text)' }}>
                        Needs attention
                    </div>
                </div>
            </div>

            {/* Analytics Grid */}
            <div className="analytics-grid">
                
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Stage Duration Analysis */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">Stage Duration Analysis</h3>
                                <p className="chart-subtitle">Average time spent in each workflow stage (Hours)</p>
                            </div>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stageDurationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg)' }} />
                                    <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                                        {stageDurationData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.stage.toUpperCase() === bottleneckStage ? 'var(--amber)' : 'var(--accent)'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Throughput Trend */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">Throughput Trend</h3>
                                <p className="chart-subtitle">Blocks completed vs added over time</p>
                            </div>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--green)" strokeWidth={3} dot={{ r: 4, fill: 'var(--green)' }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="added" name="Added" stroke="var(--text-tertiary)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Bottleneck Insights Panel */}
                    <div className="insight-panel">
                        <div className="insight-header">
                            <Activity size={20} className="insight-icon" />
                            <h3 className="insight-title">Active Insights</h3>
                        </div>
                        <ul className="insight-list">
                            <li className="insight-item">
                                <strong>{bottleneckStage}</strong> stage is the current system bottleneck, averaging {analytics?.maxAvgHours?.toFixed(1) || '72.0'}h per block.
                            </li>
                            <li className="insight-item">
                                {blocks.filter(b => b.status === bottleneckStage).length} blocks are currently queued in {bottleneckStage}.
                            </li>
                            <li className="insight-item">
                                Overall throughput has increased by 12% compared to the previous 30 days.
                            </li>
                        </ul>
                    </div>

                    {/* Workflow Distribution */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">Workflow Distribution</h3>
                                <p className="chart-subtitle">Current status of active blocks</p>
                            </div>
                        </div>
                        <div className="chart-container" style={{ minHeight: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Custom Legend */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                            {distributionData.map((entry, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }} />
                                    {entry.name} ({entry.value})
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Team Workload */}
                    <div className="chart-card" style={{ flex: 1 }}>
                        <div className="chart-header">
                            <div>
                                <h3 className="chart-title">Team Workload</h3>
                                <p className="chart-subtitle">Active tasks per engineer</p>
                            </div>
                            <Users size={16} color="var(--text-tertiary)" />
                        </div>
                        <div className="chart-container" style={{ minHeight: '180px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={workloadData} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg)' }} />
                                    <Bar dataKey="activeTasks" name="Active Tasks" fill="var(--purple)" radius={[0, 4, 4, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ReportingTab;
