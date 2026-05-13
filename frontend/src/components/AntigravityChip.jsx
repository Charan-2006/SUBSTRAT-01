import React, { useRef, useMemo, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PresentationControls, Environment, ContactShadows, Edges } from '@react-three/drei';
import * as THREE from 'three';

// --- Error Boundary for WebGL crashes ---
class WebGLErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        console.warn('AntigravityChip WebGL error caught:', error);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ 
                    width: '100%', height: '100%', minHeight: '400px', 
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 16
                }}>
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>◇</div>
                        3D visualization unavailable
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// --- Shared Premium Materials ---
const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transmission: 0.6,
    opacity: 1,
    metalness: 0.1,
    roughness: 0.1,
    ior: 1.5,
    thickness: 1,
    transparent: true,
});

const ceramicMaterial = new THREE.MeshPhysicalMaterial({
    color: '#f8fafc',
    metalness: 0.1,
    roughness: 0.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
});

const accentMaterial = new THREE.MeshStandardMaterial({
    color: '#3b82f6', // Premium Blue
    emissive: '#3b82f6',

    emissiveIntensity: 0.5,
    toneMapped: false,
});

// --- Components ---

// The main transparent substrate plate
const SubstrateBase = () => {
    return (
        <group position={[0, -0.5, 0]}>
            <mesh material={glassMaterial} receiveShadow castShadow>
                <boxGeometry args={[4, 0.1, 4]} />
            </mesh>
            {/* Very faint, premium grid/circuit lines on the base */}
            <mesh position={[0, 0.051, 0]}>
                <planeGeometry args={[3.8, 3.8]} />
                <meshBasicMaterial color="transparent" opacity={0} transparent />
                <Edges scale={1} threshold={15} color="#e2e8f0" />
            </mesh>
        </group>
    );
};

// Procedural floating blocks
const FloatingBlocks = ({ count = 25 }) => {
    // Generate deterministic but random-looking blocks
    const blocks = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            // Randomize positions strictly within the base bounds
            const x = (Math.random() - 0.5) * 3.2;
            const z = (Math.random() - 0.5) * 3.2;
            
            // Randomize dimensions (some cubes, some long memory banks)
            const isLong = Math.random() > 0.7;
            const w = isLong ? 0.2 + Math.random() * 0.8 : 0.2 + Math.random() * 0.3;
            const h = 0.1 + Math.random() * 0.4;
            const d = isLong ? 0.2 + Math.random() * 0.3 : 0.2 + Math.random() * 0.3;

            // Randomize floating properties
            const speed = 1 + Math.random() * 2;
            const offset = Math.random() * 10000;
            const yOffset = 0.2 + Math.random() * 1.5;

            // Material distribution (80% ceramic, 20% accent)
            const isAccent = Math.random() > 0.85;

            temp.push({ id: i, x, z, w, h, d, speed, offset, yOffset, isAccent });
        }
        return temp;
    }, [count]);

    return (
        <group>
            {blocks.map((block) => (
                <FloatingBlock key={block.id} data={block} />
            ))}
        </group>
    );
};

// Individual block with procedural sine wave motion
const FloatingBlock = ({ data }) => {
    const meshRef = useRef();

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        // y = sin(time * speed + offset) * amplitude + baseY
        const y = Math.sin(time * data.speed + data.offset) * 0.15 + data.yOffset;
        if (meshRef.current) {
            meshRef.current.position.y = y;
            // Very subtle rotation for some organic feel
            meshRef.current.rotation.y = Math.sin(time * data.speed * 0.5 + data.offset) * 0.05;
        }
    });

    return (
        <mesh 
            ref={meshRef} 
            position={[data.x, data.yOffset, data.z]} 
            material={data.isAccent ? accentMaterial : ceramicMaterial}
            castShadow
            receiveShadow
        >
            <boxGeometry args={[data.w, data.h, data.d]} />
            {/* Vercel/Linear thin stroke outline */}
            <Edges scale={1.001} threshold={15} color={data.isAccent ? "#3b82f6" : "#cbd5e1"} />
        </mesh>
    );
};

// Main Scene Assembly
const Scene = () => {
    return (
        <>
            {/* Global Lighting optimized for #FFFFFF background */}
            <ambientLight intensity={0.4} />
            <directionalLight 
                position={[5, 10, 5]} 
                intensity={1} 
                castShadow 
                shadow-mapSize-width={512} 
                shadow-mapSize-height={512} 
            />

            <PresentationControls 
                global={false}
                rotation={[0, 0, 0]} 
                polar={[-Math.PI / 3, Math.PI / 3]} 
                azimuth={[-Math.PI / 1.4, Math.PI / 2]}
            >
                <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
                    <group rotation={[Math.PI / 6, -Math.PI / 4, 0]}>
                        <SubstrateBase />
                        <FloatingBlocks count={18} />
                    </group>
                </Float>
            </PresentationControls>

            {/* Essential soft shadows on a white background */}
            <ContactShadows 
                position={[0, -1.5, 0]} 
                opacity={0.4} 
                scale={10} 
                blur={2.5} 
                far={4} 
                color="#94a3b8" 
            />
            
            {/* Premium lighting reflections */}
            <Environment preset="studio" />
        </>
    );
};

// Exported Container (Handles Responsive sizing automatically via React Three Fiber)
const AntigravityChip = () => {
    return (
        <div style={{ width: '100%', height: '100%', minHeight: '400px', background: '#FFFFFF', position: 'relative' }}>
            <WebGLErrorBoundary>
                <Canvas 
                    shadows 
                    dpr={[1, 1.5]} // Capped dpr for performance
                    camera={{ position: [0, 0, 8], fov: 40 }}
                    gl={{ antialias: true, alpha: true }}
                >
                    <React.Suspense fallback={null}>
                        <Scene />
                    </React.Suspense>
                </Canvas>
            </WebGLErrorBoundary>
        </div>
    );
};

export default AntigravityChip;

