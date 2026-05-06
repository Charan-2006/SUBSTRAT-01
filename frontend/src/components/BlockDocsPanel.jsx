import React, { useState } from 'react';
import { FileText, Plus, MessageSquare, ChevronRight } from 'lucide-react';
import '../pages/DocsTab.css'; // Correct path to pages directory

const BlockDocsPanel = ({ blockId, blockName }) => {
    // Dummy state for a specific block's docs/notes
    const [notes, setNotes] = useState([
        { id: 1, text: "Delayed due to missing top-level constraints.", author: "Alex", time: "2h ago" }
    ]);
    const [newNote, setNewNote] = useState('');
    
    // Dummy linked documents
    const linkedDocs = [
        { id: '2', title: 'PLL Phase Noise Reduction Notes' }
    ];

    const handleAddNote = (e) => {
        if (e.key === 'Enter' && newNote.trim()) {
            setNotes([...notes, { 
                id: Date.now(), 
                text: newNote.trim(), 
                author: "You", 
                time: "Just now" 
            }]);
            setNewNote('');
        }
    };

    return (
        <div className="block-docs-panel" style={{ 
            background: 'var(--bg)', 
            border: '1px solid var(--border)', 
            borderRadius: '8px',
            padding: '16px',
            marginTop: '12px'
        }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Knowledge & Context
            </h4>
            
            {/* Linked Documents Section */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: '8px' }}>
                    Linked Documents
                </div>
                {linkedDocs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {linkedDocs.map(doc => (
                            <div key={doc.id} style={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'var(--surface)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer'
                            }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{doc.title}</span>
                                <ChevronRight size={14} color="var(--text-tertiary)" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No documents linked.</div>
                )}
                <button className="docs-btn docs-btn-ghost" style={{ marginTop: '8px', padding: '4px 8px', fontSize: '12px' }}>
                    <Plus size={12} /> Link Document
                </button>
            </div>

            {/* Smart Notes Section */}
            <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: '8px' }}>
                    Smart Notes
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', maxHeight: '150px', overflowY: 'auto' }}>
                    {notes.map(note => (
                        <div key={note.id} style={{ background: 'var(--surface)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-primary)' }}>{note.text}</p>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{note.author}</span>
                                <span>{note.time}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ position: 'relative' }}>
                    <MessageSquare size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input 
                        type="text" 
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyDown={handleAddNote}
                        placeholder="Add a quick note... (Press Enter)"
                        style={{
                            width: '100%', padding: '8px 12px 8px 30px', fontSize: '13px',
                            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px',
                            color: 'var(--text-primary)', outline: 'none'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default BlockDocsPanel;
