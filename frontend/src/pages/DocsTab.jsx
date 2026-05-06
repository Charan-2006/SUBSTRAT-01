import React, { useState, useMemo } from 'react';
import { Search, Plus, FileText, ChevronLeft, Save, Trash2, Bold, Italic, List } from 'lucide-react';
import './DocsTab.css';

// --- Dummy Data ---
const DUMMY_DOCS = [
    {
        id: '1',
        title: 'Analog Layout Guidelines v2',
        excerpt: 'Standard operating procedures for routing sensitive analog nets, including matched pairs and shielding requirements.',
        tag: 'guidelines',
        content: '# Analog Layout Guidelines v2\n\n1. **Matched Pairs**: Always use common-centroid or interdigitated layouts for critical differential pairs.\n2. **Shielding**: Clock lines must be shielded with VSS to prevent coupling into analog signals.\n3. **Current Density**: Ensure electromigration (EM) limits are respected for high-current paths.',
        updatedAt: '2023-10-24T10:30:00Z',
        linkedBlock: null
    },
    {
        id: '2',
        title: 'PLL Phase Noise Reduction Notes',
        excerpt: 'Summary of the recent design review regarding phase noise in the 5GHz PLL core.',
        tag: 'notes',
        content: '# PLL Phase Noise Notes\n\n- The VCO core needs wider metal traces to reduce resistance.\n- Substrate noise coupling is suspected. Added guard rings around the VCO.\n- Need to check the LDO noise contribution.',
        updatedAt: '2023-10-25T14:15:00Z',
        linkedBlock: 'block_123' 
    },
    {
        id: '3',
        title: 'Top-Level Floorplan Strategy',
        excerpt: 'Initial floorplan constraints for the upcoming tapeout. IP placement and IO ring details.',
        tag: 'design',
        content: '# Floorplan Strategy\n\n- Place high-speed IOs on the North edge.\n- Keep sensitive analog blocks (ADC, DAC) on the South edge, away from digital switching noise.\n- Power rings: M7/M8 mesh.',
        updatedAt: '2023-10-20T09:00:00Z',
        linkedBlock: null
    }
];

const DocsTab = ({ blocks = [] }) => {
    const [docs, setDocs] = useState(DUMMY_DOCS);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDoc, setActiveDoc] = useState(null); // null means list view
    const [isEditing, setIsEditing] = useState(false);

    // Filter docs based on search
    const filteredDocs = useMemo(() => {
        if (!searchQuery.trim()) return docs;
        const q = searchQuery.toLowerCase();
        return docs.filter(d => 
            d.title.toLowerCase().includes(q) || 
            d.excerpt.toLowerCase().includes(q)
        );
    }, [docs, searchQuery]);

    const handleCreateDoc = () => {
        const newDoc = {
            id: Date.now().toString(),
            title: '',
            excerpt: '',
            content: '',
            tag: 'notes',
            updatedAt: new Date().toISOString()
        };
        setActiveDoc(newDoc);
        setIsEditing(true);
    };

    const handleSaveDoc = () => {
        if (!activeDoc) return;
        
        // Auto-generate excerpt if empty
        let updatedDoc = { ...activeDoc, updatedAt: new Date().toISOString() };
        if (!updatedDoc.excerpt && updatedDoc.content) {
            updatedDoc.excerpt = updatedDoc.content.substring(0, 100).replace(/#/g, '').trim() + '...';
        }

        const existingIdx = docs.findIndex(d => d.id === updatedDoc.id);
        if (existingIdx >= 0) {
            const newDocs = [...docs];
            newDocs[existingIdx] = updatedDoc;
            setDocs(newDocs);
        } else {
            setDocs([updatedDoc, ...docs]);
        }
        setIsEditing(false);
    };

    const handleDeleteDoc = (id) => {
        if (window.confirm('Are you sure you want to delete this document?')) {
            setDocs(docs.filter(d => d.id !== id));
            if (activeDoc && activeDoc.id === id) {
                setActiveDoc(null);
                setIsEditing(false);
            }
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // --- Editor View ---
    if (activeDoc) {
        return (
            <div className="docs-container fade-in" style={{ padding: '24px 32px' }}>
                <div className="doc-editor-container">
                    {/* Editor Toolbar */}
                    <div className="doc-editor-toolbar">
                        <div className="doc-editor-breadcrumbs">
                            <button className="docs-btn docs-btn-ghost" onClick={() => setActiveDoc(null)} style={{ padding: '4px 8px' }}>
                                <ChevronLeft size={16} /> Back to Docs
                            </button>
                        </div>
                        <div className="docs-actions">
                            <div className="doc-format-bar">
                                <button className="format-btn"><Bold size={14} /></button>
                                <button className="format-btn"><Italic size={14} /></button>
                                <button className="format-btn"><List size={14} /></button>
                            </div>
                            <button className="docs-btn docs-btn-secondary" onClick={() => handleDeleteDoc(activeDoc.id)}>
                                <Trash2 size={14} /> Delete
                            </button>
                            <button className="docs-btn docs-btn-primary" onClick={handleSaveDoc}>
                                <Save size={14} /> Save Note
                            </button>
                        </div>
                    </div>

                    {/* Editor Title */}
                    <input 
                        type="text"
                        className="doc-editor-title-input"
                        placeholder="Untitled Document"
                        value={activeDoc.title}
                        onChange={(e) => setActiveDoc({ ...activeDoc, title: e.target.value })}
                    />

                    {/* Editor Content Area */}
                    <div className="doc-editor-content-area">
                        <textarea 
                            className="doc-editor-textarea"
                            placeholder="Start typing your notes or guidelines here. Markdown is supported."
                            value={activeDoc.content}
                            onChange={(e) => setActiveDoc({ ...activeDoc, content: e.target.value })}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // --- List View ---
    return (
        <div className="docs-container fade-in">
            <div className="docs-header">
                <div className="docs-title">
                    <h2>Project Knowledge</h2>
                    <p>Quick notes, guidelines, and context linked to your workflows.</p>
                </div>
                <div className="docs-actions">
                    <div className="docs-search-wrapper">
                        <Search size={14} className="docs-search-icon" />
                        <input 
                            type="text" 
                            className="docs-search-input" 
                            placeholder="Search docs..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="docs-btn docs-btn-primary" onClick={handleCreateDoc}>
                        <Plus size={16} /> New Doc
                    </button>
                </div>
            </div>

            <div className="docs-grid">
                {filteredDocs.map(doc => (
                    <div key={doc.id} className="doc-card" onClick={() => { setActiveDoc(doc); setIsEditing(true); }}>
                        <div className="doc-card-header">
                            <h3 className="doc-card-title">{doc.title || 'Untitled Document'}</h3>
                            <span className={`doc-card-tag ${doc.tag}`}>{doc.tag}</span>
                        </div>
                        <p className="doc-card-excerpt">
                            {doc.excerpt || 'No content.'}
                        </p>
                        <div className="doc-card-footer">
                            <FileText size={12} />
                            Updated {formatDate(doc.updatedAt)}
                            {doc.linkedBlock && (
                                <span style={{ marginLeft: 'auto', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
                                    Linked
                                </span>
                            )}
                        </div>
                    </div>
                ))}
                
                {filteredDocs.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
                        <FileText size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                        <p>No documents found matching "{searchQuery}".</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocsTab;
