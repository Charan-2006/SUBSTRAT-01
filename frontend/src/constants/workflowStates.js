export const STAGES = {
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    DRC: 'DRC',
    LVS: 'LVS',
    REVIEW: 'REVIEW',
    COMPLETED: 'COMPLETED',
};

export const STAGE_LABELS = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    DRC: 'DRC',
    LVS: 'LVS',
    REVIEW: 'Review',
    COMPLETED: 'Completed',
};

export const STAGE_COLORS = {
    NOT_STARTED: 'var(--text-tertiary)',
    IN_PROGRESS: '#2563eb',
    DRC: '#f59e0b',
    LVS: '#eab308',
    REVIEW: '#8b5cf6',
    COMPLETED: '#22c55e',
};

export const STAGE_PROGRESS_BASELINES = {
    NOT_STARTED: 0,
    IN_PROGRESS: 25,
    DRC: 50,
    LVS: 70,
    REVIEW: 90,
    COMPLETED: 100,
};

export const STAGE_EXPECTED_HOURS = {
    NOT_STARTED: 0,
    IN_PROGRESS: 8,
    DRC: 4,
    LVS: 5,
    REVIEW: 3,
    COMPLETED: 0,
};

export const VALID_TRANSITIONS = {
    NOT_STARTED: ['IN_PROGRESS'],
    IN_PROGRESS: ['DRC'],
    DRC: ['LVS'],
    LVS: ['REVIEW'],
    REVIEW: ['COMPLETED', 'LVS', 'DRC', 'IN_PROGRESS'], // Rollbacks allowed
    COMPLETED: [],
};

export const HEALTH_STATES = {
    HEALTHY: 'HEALTHY',
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL',
    BOTTLENECK: 'BOTTLENECK',
    BLOCKED: 'BLOCKED',
    CASCADING: 'CASCADING',
};

export const HEALTH_LABELS = {
    HEALTHY: 'Healthy',
    WARNING: 'Bottleneck',
    CRITICAL: 'Critical',
    BOTTLENECK: 'Bottleneck',
    BLOCKED: 'Blocked',
    CASCADING: 'Cascading',
};

export const EXECUTION_FLAGS = {
    BOTTLENECKED: 'BOTTLENECKED',
    ESCALATED: 'ESCALATED',
    DELAYED: 'DELAYED',
    BLOCKED: 'BLOCKED',
};

export const BLOCK_TYPES = [
    'Inverter', 'Current Mirror', 'Differential Pair', 'Bandgap Reference', 
    'OTA', 'PLL', 'ADC', 'DAC', 'SRAM', 'LDO'
];

export const TECH_NODES = [
    '180nm', '130nm', '90nm', '65nm', '45nm', '28nm', '14nm', '7nm'
];

export const COMPLEXITY_LEVELS = ['SIMPLE', 'MEDIUM', 'COMPLEX', 'CRITICAL'];

