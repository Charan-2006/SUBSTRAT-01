import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { Activity, Calendar, AlertTriangle, Users, ArrowRight } from 'lucide-react';
import AntigravityChip from '../components/AntigravityChip';
import './LandingPage.css';

/* ─── Animation Variants ─── */
const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
    })
};

const stagger = {
    visible: { transition: { staggerChildren: 0.12 } }
};

// Removed floatingCards for 3D Chip integration

/* ─── Feature Data ─── */
const features = [
    {
        icon: <Activity size={24} />, iconClass: 'icon-blue',
        title: 'Workflow Visibility',
        desc: 'See every block\'s journey from design to signoff in a single, unified view.'
    },
    {
        icon: <Calendar size={24} />, iconClass: 'icon-purple',
        title: 'Timeline Tracking',
        desc: 'Gantt-style roadmaps keep your team aligned on deadlines and dependencies.'
    },
    {
        icon: <AlertTriangle size={24} />, iconClass: 'icon-amber',
        title: 'Bottleneck Detection',
        desc: 'AI-powered alerts surface workflow bottlenecks before they become blockers.'
    },
    {
        icon: <Users size={24} />, iconClass: 'icon-green',
        title: 'Team Coordination',
        desc: 'Assign, track, and balance workloads across your engineering team in real time.'
    }
];

/* ─── Mock Data for Timeline ─── */
const mockRows = [
    { name: 'ADC_CORE_01', status: 'IN PROGRESS', color: '#3b82f6', barWidth: '65%' },
    { name: 'BIAS_GEN_TOP', status: 'DRC CLEAN', color: '#22c55e', barWidth: '100%' },
    { name: 'PLL_SYNTH_04', status: 'IN REVIEW', color: '#8b5cf6', barWidth: '85%' },
    { name: 'SRAM_CTRL_16x', status: 'LVS PENDING', color: '#f59e0b', barWidth: '45%' },
];

/* ─── Google SVG Icon ─── */
const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

/* ============================================================
   LANDING PAGE COMPONENT
   ============================================================ */
const LandingPage = () => {
    const { user, loading } = useContext(AuthContext);
    const [scrolled, setScrolled] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (loading) return null;
    if (user) return <Navigate to="/dashboard" replace />;

    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:5001/api/auth/google';
    };

    return (
        <div className="landing-page">
            {/* ─── NAVBAR ─── */}
            <nav className={`lp-navbar ${scrolled ? 'scrolled' : ''}`}>
                <a className="lp-navbar-brand" href="#">
                    <div className="lp-brand-logo">S</div>
                    SUBSTRAT
                </a>
                <div className="lp-navbar-links">
                    <a href="#features">Features</a>
                    <a href="#how-it-works">How It Works</a>
                    <a href="#preview">Preview</a>
                </div>
                <div className="lp-navbar-actions">
                    <button className="lp-btn lp-btn-ghost" onClick={handleGoogleLogin}>
                        Log In
                    </button>
                    <button className="lp-btn lp-btn-primary" onClick={handleGoogleLogin}>
                        Get Started
                    </button>
                </div>
            </nav>

            {/* ─── HERO ─── */}
            <section className="lp-hero">
                <div className="lp-hero-content-wrapper">
                    <motion.div
                        className="lp-hero-content"
                        initial="hidden"
                        animate="visible"
                        variants={stagger}
                    >
                        <motion.div variants={fadeUp} custom={0} className="lp-hero-badge">
                            <span className="lp-hero-badge-dot" />
                            Now in active development
                        </motion.div>

                        <motion.h1 variants={fadeUp} custom={1} className="lp-hero-title">
                            Build. Track. Deliver<br />
                            — <span className="gradient-text">Faster.</span>
                        </motion.h1>

                        <motion.p variants={fadeUp} custom={2} className="lp-hero-subtitle">
                            SUBSTRAT simplifies engineering workflows with clarity, control, and real-time insights.
                        </motion.p>

                        <motion.div variants={fadeUp} custom={3} className="lp-hero-cta">
                            <button className="lp-btn lp-btn-google" onClick={handleGoogleLogin}>
                                <GoogleIcon />
                                Continue with Google
                            </button>
                            <button className="lp-btn lp-btn-secondary" onClick={handleGoogleLogin}>
                                View Demo →
                            </button>
                        </motion.div>
                    </motion.div>
                </div>
                
                <div className="lp-hero-canvas-wrapper">
                    <AntigravityChip />
                </div>
            </section>

            {/* ─── FEATURES ─── */}
            <section className="lp-section" id="features">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-100px' }}
                    variants={stagger}
                >
                    <motion.div variants={fadeUp} className="lp-section-label">✦ Features</motion.div>
                    <motion.h2 variants={fadeUp} className="lp-section-title">
                        Everything you need to<br />ship layouts on time.
                    </motion.h2>
                    <motion.p variants={fadeUp} className="lp-section-subtitle">
                        From block creation to final signoff — one platform, zero guesswork.
                    </motion.p>

                    <motion.div className="lp-features-grid" variants={stagger}>
                        {features.map((f, i) => (
                            <motion.div key={i} className="lp-feature-card" variants={fadeUp} custom={i}>
                                <div className={`lp-feature-icon ${f.iconClass}`}>{f.icon}</div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>
            </section>

            {/* ─── PRODUCT PREVIEW ─── */}
            <section className="lp-preview-section" id="preview">
                <motion.div
                    className="lp-preview-container premium-mock-ui"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                    <div className="lp-preview-header-mac">
                        <div className="lp-preview-dot red" />
                        <div className="lp-preview-dot yellow" />
                        <div className="lp-preview-dot green" />
                    </div>

                    <div className="lp-preview-content">
                        {/* Context Header */}
                        <div className="lp-preview-context-header">
                            <div>
                                <h3 className="lp-preview-context-title">Live Workflow Timeline</h3>
                                <p className="lp-preview-context-subtitle">Track every block from design to signoff</p>
                            </div>
                            <div className="lp-preview-live-indicator">
                                <span className="lp-live-dot" /> Live
                            </div>
                        </div>

                        {/* Structured Rows */}
                        <div className="lp-preview-rows-wrapper">
                            {mockRows.map((row, i) => (
                                <motion.div 
                                    key={i} 
                                    className="lp-mock-row"
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.1 * i, duration: 0.5 }}
                                >
                                    <div className="lp-mock-row-header">
                                        <div className="lp-mock-block-name">{row.name}</div>
                                        <motion.div 
                                            className="lp-mock-badge" 
                                            style={{ background: `${row.color}15`, color: row.color, border: `1px solid ${row.color}30` }}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: 0.5 + (i * 0.1), duration: 0.4 }}
                                        >
                                            {row.status}
                                        </motion.div>
                                    </div>
                                        <div className="lp-mock-bar-container">
                                            <motion.div 
                                                className="lp-mock-bar-fill" 
                                                style={{ 
                                                    background: `linear-gradient(90deg, #6366f1, #4F46E5)`, 
                                                    boxShadow: `0 0 10px rgba(79,70,229,0.3)`
                                                }}
                                                initial={{ width: '0%' }}
                                                whileInView={{ width: row.barWidth }}
                                                viewport={{ once: true }}
                                                transition={{ delay: 0.2 + (i * 0.1), duration: 1.5, ease: "easeOut" }}
                                            />
                                        </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ─── HOW IT WORKS ─── */}
            <section className="lp-section" id="how-it-works">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-100px' }}
                    variants={stagger}
                >
                    <motion.div variants={fadeUp} className="lp-section-label">✦ How It Works</motion.div>
                    <motion.h2 variants={fadeUp} className="lp-section-title">
                        Three steps to clarity.
                    </motion.h2>
                    <motion.p variants={fadeUp} className="lp-section-subtitle">
                        No setup guides. No onboarding calls. Just start.
                    </motion.p>

                    <div className="lp-steps-container-vertical">
                        <motion.div 
                            className="lp-steps-connection-line-vertical"
                            initial={{ scaleY: 0 }}
                            whileInView={{ scaleY: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                            style={{ transformOrigin: "top" }}
                        />
                        <div className="lp-steps-grid-vertical">
                            {[
                                { num: '1', title: 'Create or Request', desc: 'Submit layout blocks or file structured requests through the intake system.' },
                                { num: '2', title: 'Track Progress', desc: 'Monitor real-time status across DRC, LVS, Review, and all workflow stages.' },
                                { num: '3', title: 'Deliver with Clarity', desc: 'Ship on time with bottleneck alerts, health monitoring, and team insights.' }
                            ].map((step, i) => (
                                <motion.div key={i} className="lp-step-vertical" variants={fadeUp} custom={i}>
                                    <div className="lp-step-indicator-node" />
                                    <div className="lp-step-content-vertical">
                                        <h3>{step.title}</h3>
                                        <p>{step.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ─── CTA ─── */}
            <section className="lp-cta-section">
                <motion.div
                    className="lp-cta-content"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={stagger}
                >
                    <motion.h2 variants={fadeUp}>Ready to move faster?</motion.h2>
                    <motion.p variants={fadeUp}>
                        Join engineering teams already using SUBSTRAT to streamline their layout workflows.
                    </motion.p>
                    <motion.div variants={fadeUp} style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="lp-btn lp-btn-google" onClick={handleGoogleLogin}>
                            <GoogleIcon />
                            Get Started with Google
                        </button>
                    </motion.div>
                </motion.div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="lp-footer">
                <div className="lp-footer-brand">
                    <div className="lp-brand-logo" style={{ width: 24, height: 24, fontSize: 12, borderRadius: 6 }}>S</div>
                    © {new Date().getFullYear()} SUBSTRAT
                </div>
                <div className="lp-footer-links">
                    <a href="#features">Features</a>
                    <a href="#how-it-works">How It Works</a>
                    <a href="#preview">Preview</a>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
