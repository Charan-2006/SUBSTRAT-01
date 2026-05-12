import React, { useState, useMemo } from 'react';
import { Search, X, Layers, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { hasCircularDependency } from '../utils/workflowEngine';

const DependencySelector = ({ 
    selectedIds = [], 
    allBlocks = [], 
    targetBlockId = null,
    onSelect, 
    onRemove 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const filteredBlocks = useMemo(() => {
        return allBlocks.filter(block => {
            const blockId = block._id || block.id;
            
            // 1. Hide self
            if (targetBlockId && blockId === targetBlockId) return false;
            
            // 2. Hide already selected
            if (selectedIds.includes(blockId)) return false;
            
            // 3. Hide completed blocks
            if (block.status === 'COMPLETED') return false;
            
            // 4. Search match
            return block.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   (block.type || '').toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [allBlocks, selectedIds, searchTerm, targetBlockId]);

    const handleSelect = (block) => {
        const blockId = block._id || block.id;
        
        // Circular check
        if (targetBlockId && hasCircularDependency(targetBlockId, blockId, allBlocks)) {
            alert(`Circular Dependency Error: ${block.name} already depends on a chain leading to this block.`);
            return;
        }

        onSelect(blockId);
        setSearchTerm('');
        setIsOpen(false);
    };

    const selectedBlocks = selectedIds.map(id => allBlocks.find(b => (b._id || b.id) === id)).filter(Boolean);

    return (
        <div className="dependency-selector-container">
            <div className="selected-dependencies-strip">
                {selectedBlocks.map(block => (
                    <div key={block._id || block.id} className="dependency-tag">
                        <span className="tag-name">{block.name}</span>
                        <span className={`tag-status status-${block.status.toLowerCase()}`}>{block.status}</span>
                        <button className="tag-remove" onClick={() => onRemove(block._id || block.id)}>
                            <X size={10} />
                        </button>
                    </div>
                ))}
                {selectedBlocks.length === 0 && <span className="placeholder-text">No dependencies selected</span>}
            </div>

            <div className="selector-search-wrapper">
                <div className="search-input-box">
                    <Search size={14} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search blocks to add dependency..." 
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                    />
                    {searchTerm && (
                        <button className="clear-search" onClick={() => setSearchTerm('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                {isOpen && searchTerm && (
                    <div className="selector-dropdown fade-in">
                        {filteredBlocks.length > 0 ? (
                            filteredBlocks.map(block => (
                                <div 
                                    key={block._id || block.id} 
                                    className="dropdown-item"
                                    onClick={() => handleSelect(block)}
                                >
                                    <div className="item-main">
                                        <Layers size={14} className="item-icon" />
                                        <div className="item-info">
                                            <span className="item-name">{block.name}</span>
                                            <span className="item-meta">{block.type} • {block.techNode}</span>
                                        </div>
                                    </div>
                                    <div className="item-status">
                                        <span className={`status-badge status-${(block.health || 'HEALTHY').toLowerCase()}`}>
                                            {block.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-results">No available blocks found</div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .dependency-selector-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                }
                .selected-dependencies-strip {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    min-height: 32px;
                    padding: 4px 8px;
                    background: var(--surface-subtle);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                }
                .dependency-tag {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 4px;
                    padding: 2px 6px;
                    font-size: 11px;
                    font-weight: 600;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .tag-name { color: var(--text-primary); }
                .tag-status { 
                    font-size: 9px; 
                    padding: 1px 4px; 
                    border-radius: 3px;
                    background: var(--accent-subtle);
                    color: var(--accent);
                }
                .tag-remove {
                    background: transparent;
                    border: none;
                    color: var(--text-tertiary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    padding: 2px;
                    border-radius: 50%;
                }
                .tag-remove:hover {
                    background: var(--red-subtle);
                    color: var(--red);
                }
                .placeholder-text {
                    font-size: 12px;
                    color: var(--text-tertiary);
                    font-style: italic;
                    line-height: 24px;
                }
                .selector-search-wrapper {
                    position: relative;
                }
                .search-input-box {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    padding: 0 10px;
                    height: 36px;
                    transition: border-color 0.2s ease;
                }
                .search-input-box:focus-within {
                    border-color: var(--accent);
                }
                .search-input-box input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    font-size: 13px;
                    color: var(--text-primary);
                }
                .search-icon { color: var(--text-tertiary); }
                .clear-search {
                    background: transparent;
                    border: none;
                    color: var(--text-tertiary);
                    cursor: pointer;
                }
                .selector-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    margin-top: 4px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
                    z-index: 1000;
                    max-height: 240px;
                    overflow-y: auto;
                    padding: 4px;
                }
                .dropdown-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background 0.1s ease;
                }
                .dropdown-item:hover {
                    background: var(--accent-subtle);
                }
                .item-main {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .item-icon { color: var(--text-tertiary); }
                .item-info {
                    display: flex;
                    flex-direction: column;
                }
                .item-name {
                    font-size: 13px;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .item-meta {
                    font-size: 10px;
                    color: var(--text-tertiary);
                }
                .status-badge {
                    font-size: 9px;
                    font-weight: 800;
                    padding: 2px 6px;
                    border-radius: 4px;
                    text-transform: uppercase;
                }
                .status-healthy { background: var(--green-subtle); color: var(--green); }
                .status-warning { background: var(--amber-subtle); color: var(--amber); }
                .status-critical { background: var(--red-subtle); color: var(--red); }
                .no-results {
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: var(--text-tertiary);
                }
            `}</style>
        </div>
    );
};

export default DependencySelector;
