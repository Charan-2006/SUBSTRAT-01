import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Play, Pause, SkipForward, RotateCcw, 
    X, Clock, User as UserIcon, AlertTriangle, Layers
} from 'lucide-react';
import './SmartReplay.css';

const STAGES_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'DRC', 'LVS', 'REVIEW', 'COMPLETED'];

const SmartReplay = ({ block, onClose }) => {
    const [viewMode, setViewMode] = useState('REPLAY'); // REPLAY | STATIC
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    
    // Parse stage history into a sequential story
    const storySteps = useMemo(() => {
        if (!block) return [];
        
        let steps = [];
        if (block.stageHistory && block.stageHistory.length > 0) {
            steps = [...block.stageHistory].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        } else {
            // Fallback if no history exists (e.g. just created)
            steps = [{
                stage: block.status,
                startTime: block.createdAt,
                durationHours: 0
            }];
        }

        return steps.map((step, idx) => {
            const isBottleneck = step.durationHours > 24; // > 24h threshold
            return {
                ...step,
                isBottleneck,
                assignee: block.assignedEngineer?.displayName || 'Unassigned'
            };
        });
    }, [block]);

    // Playback Engine
    useEffect(() => {
        let timer;
        if (isPlaying && currentStep < storySteps.length) {
            const baseDelay = 1200; // ms per step
            timer = setTimeout(() => {
                setCurrentStep(prev => prev + 1);
            }, baseDelay / playbackSpeed);
        } else if (currentStep >= storySteps.length) {
            setIsPlaying(false);
        }
        return () => clearTimeout(timer);
    }, [isPlaying, currentStep, storySteps.length, playbackSpeed]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === ' ') {
                e.preventDefault();
                togglePlay();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Auto-start replay mode
    useEffect(() => {
        if (viewMode === 'REPLAY' && currentStep === 0) {
            setIsPlaying(true);
        }
    }, [viewMode]);

    if (!block) return null;

    const togglePlay = () => {
        if (currentStep >= storySteps.length) {
            setCurrentStep(0);
            setIsPlaying(true);
        } else {
            setIsPlaying(!isPlaying);
        }
    };

    const skipToEnd = () => {
        setIsPlaying(false);
        setCurrentStep(storySteps.length);
    };

    const replay = () => {
        setCurrentStep(0);
        setIsPlaying(true);
    };

    const toggleSpeed = () => {
        const speeds = [1, 1.5, 2];
        const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
        setPlaybackSpeed(speeds[nextIdx]);
    };

    // Calculate line fill percentage
    const fillPercentage = storySteps.length > 1 
        ? Math.min(100, Math.max(0, (currentStep / (storySteps.length - 1)) * 100))
        : 100;

    return (
        <div className="smart-replay-overlay">
            <div className="sr-header">
                <div className="sr-title">
                    <Layers size={24} color="var(--accent)" />
                    {block.name}
                </div>
                
                <div className="sr-controls-top">
                    <div className="sr-mode-switch">
                        <button 
                            className={`sr-mode-btn ${viewMode === 'REPLAY' ? 'active' : ''}`}
                            onClick={() => setViewMode('REPLAY')}
                        >
                            Replay Mode
                        </button>
                        <button 
                            className={`sr-mode-btn ${viewMode === 'STATIC' ? 'active' : ''}`}
                            onClick={() => {
                                setViewMode('STATIC');
                                setIsPlaying(false);
                                setCurrentStep(storySteps.length);
                            }}
                        >
                            Static Mode
                        </button>
                    </div>
                    <button className="sr-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="sr-body">
                <div className="sr-flow-container">
                    <div className="sr-flow-line-track">
                        <div 
                            className="sr-flow-line-fill" 
                            style={{ 
                                width: viewMode === 'STATIC' ? '100%' : `${fillPercentage}%` 
                            }} 
                        />
                    </div>

                    {storySteps.map((step, idx) => {
                        const isVisible = viewMode === 'STATIC' || idx <= currentStep;
                        const isActive = viewMode === 'REPLAY' && idx === currentStep && isPlaying;
                        const isPast = viewMode === 'STATIC' || idx < currentStep;

                        return (
                            <div key={idx} className="sr-node-wrapper">
                                <div className={`sr-node 
                                    ${isActive ? 'active' : ''} 
                                    ${isPast ? 'completed' : ''} 
                                    ${step.isBottleneck && isVisible ? 'bottleneck' : ''}
                                `}>
                                    {isPast && !step.isBottleneck && <span style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} />}
                                </div>
                                
                                <div className={`sr-event-card 
                                    ${isVisible ? 'visible' : ''} 
                                    ${isActive ? 'active' : ''}
                                    ${step.isBottleneck ? 'bottleneck' : ''}
                                `}>
                                    <div className="sr-card-stage">{step.stage.replace('_', ' ')}</div>
                                    <div className="sr-card-detail">
                                        <Clock size={12} />
                                        {new Date(step.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="sr-card-detail">
                                        <UserIcon size={12} />
                                        {step.assignee}
                                    </div>
                                    
                                    {step.durationHours > 0 && (
                                        <div className="sr-card-detail" style={{ marginTop: 8 }}>
                                            Duration: {step.durationHours.toFixed(1)}h
                                        </div>
                                    )}

                                    {step.isBottleneck && (
                                        <div className="sr-bottleneck-label">
                                            <AlertTriangle size={12} />
                                            Delayed ({step.durationHours.toFixed(1)}h)
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {viewMode === 'REPLAY' && (
                <div className="sr-controls-bottom">
                    <button className="sr-control-btn" onClick={replay} title="Replay">
                        <RotateCcw size={18} />
                    </button>
                    
                    <button className="sr-control-btn primary" onClick={togglePlay}>
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 4 }} />}
                    </button>
                    
                    <button className="sr-control-btn" onClick={skipToEnd} disabled={currentStep >= storySteps.length} title="Skip to End">
                        <SkipForward size={18} />
                    </button>

                    <button className="sr-speed-btn" onClick={toggleSpeed}>
                        {playbackSpeed}x
                    </button>
                </div>
            )}
        </div>
    );
};

export default SmartReplay;
