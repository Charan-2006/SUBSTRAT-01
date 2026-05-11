import React, { useMemo } from 'react';
import { BookOpen, Shield, Link2, Zap } from 'lucide-react';

const SD={IN_PROGRESS:['Layout Routing Guidelines','Metal Density Constraints','Power Grid Design Rules'],DRC:['DRC Rule Deck Reference','Common DRC Violations','Antenna Rule Checklist'],LVS:['LVS Debug Methodology','Netlist Comparison Guide','Device Recognition Rules'],REVIEW:['Review Submission Checklist','Sign-off Criteria','Reviewer Feedback Templates']};
const tc=t=>t==='analysis'?'t-red':t==='dependency'?'t-blu':t==='verification'?'t-amb':'t-grn';

const EngKnowledge=({myBlocks})=>{
    const stages=useMemo(()=>{const s=new Set();myBlocks.filter(b=>!['NOT_STARTED','COMPLETED'].includes(b.status)).forEach(b=>s.add(b.status));return[...s];},[myBlocks]);
    const suggested=useMemo(()=>{const d=[];stages.forEach(s=>(SD[s]||[]).forEach(t=>d.push({title:t,stage:s})));return d;},[stages]);
    const linked=useMemo(()=>{const d=[];myBlocks.forEach(b=>{if(b.rejectionCount>0)d.push({title:`${b.name} — Rejection Analysis`,blk:b.name,type:'analysis',stage:b.status});if((b.dependencies||[]).length>0)d.push({title:`${b.name} — Dependency Map`,blk:b.name,type:'dependency',stage:b.status});if(['DRC','LVS'].includes(b.status))d.push({title:`${b.name} — Verification Notes`,blk:b.name,type:'verification',stage:b.status});});return d;},[myBlocks]);

    return (
        <div className="ew-grid">
            <div className="ew-col">
                {suggested.length>0&&<div>
                    <div className="ew-sh"><Shield size={10}/> Stage-Relevant ({suggested.length})</div>
                    {suggested.map((d,i)=>(
                        <div key={i} className="ew-wf h-ok" style={{cursor:'pointer'}}>
                            <div className="ew-wf-body"><div className="ew-r1"><span className="ew-r1-name">{d.title}</span><span className="ew-t t-grn">Guideline</span><span className="ew-t t-blu">{d.stage.replace('_',' ')}</span></div></div>
                        </div>
                    ))}
                </div>}
                {linked.length>0&&<div>
                    <div className="ew-sh"><Link2 size={10}/> Workflow-Linked ({linked.length})</div>
                    {linked.map((d,i)=>(
                        <div key={i} className="ew-wf" style={{cursor:'pointer'}}>
                            <div className="ew-wf-body"><div className="ew-r1"><span className="ew-r1-name">{d.title}</span><span className={`ew-t ${tc(d.type)}`}>{d.type}</span></div><div className="ew-r4"><span className="ew-t t-blu">{d.blk}</span><span className="ew-t t-gry">{d.stage.replace('_',' ')}</span></div></div>
                        </div>
                    ))}
                </div>}
                {!suggested.length&&!linked.length&&<div className="ew-empty">No knowledge articles for current workflows.</div>}
            </div>
            <div className="ew-side">
                <div className="ew-sp"><div className="ew-sp-title"><BookOpen size={9}/> Reference</div><div className="ew-sp-row"><div className="ew-sp-dot" style={{background:'#22c55e'}}/><div><strong>{suggested.length}</strong> stage docs</div></div><div className="ew-sp-row"><div className="ew-sp-dot" style={{background:'#2563eb'}}/><div><strong>{linked.length}</strong> linked</div></div><div className="ew-sp-row"><div className="ew-sp-dot" style={{background:'#7c3aed'}}/><div><strong>{stages.length}</strong> active stages</div></div></div>
                {linked.filter(d=>d.type==='analysis').length>0&&<div className="ew-sp"><div className="ew-sp-title"><Zap size={9}/> Review Intel</div>{linked.filter(d=>d.type==='analysis').map((d,i)=><div key={i} className="ew-sp-row"><div className="ew-sp-dot" style={{background:'#ef4444'}}/><div><strong>{d.blk}</strong></div></div>)}</div>}
            </div>
        </div>
    );
};
export default EngKnowledge;
