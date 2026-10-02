'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface RiskVortexProps {
  score: number; // 0 to 100
}

function VortexCore({ score }: { score: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);

  // Map score to visual properties
  const color = useMemo(() => {
    if (score < 30) return '#10b981'; // Low - Emerald
    if (score < 60) return '#f59e0b'; // Medium - Amber
    if (score < 85) return '#f97316'; // High - Orange
    return '#ef4444'; // Critical - Crimson
  }, [score]);

  const distortion = useMemo(() => {
    return (score / 100) * 0.55;
  }, [score]);

  const speed = useMemo(() => {
    return 0.8 + (score / 100) * 2.2;
  }, [score]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4 * speed;
      meshRef.current.rotation.z += delta * 0.2 * speed;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.5;
      ringRef.current.rotation.x += delta * 0.2;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <MeshDistortMaterial
          color={color}
          speed={speed}
          distort={distortion}
          radius={1}
          emissive={color}
          emissiveIntensity={0.6 + (score / 100) * 0.8}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Outer Holographic Containment Ring */}
      <group ref={ringRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.4, 1.44, 48]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.35} />
        </mesh>
      </group>
    </group>
  );
}

// Deterministic orbital field without random SSR hydration differences
function OrbitField({ color }: { color: string }) {
  const particles = useMemo(() => {
    const pts = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 1.7 + ((i % 4) * 0.15);
      const x = r * Math.cos(theta) * Math.sin(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(phi);
      pts.push([x, y, z] as [number, number, number]);
    }
    return pts;
  }, []);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((pt, i) => (
        <mesh key={i} position={pt}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export default function RiskVortex({ score }: RiskVortexProps) {
  const primaryColor = useMemo(() => {
    if (score < 30) return '#10b981';
    if (score < 60) return '#f59e0b';
    if (score < 85) return '#f97316';
    return '#ef4444';
  }, [score]);

  return (
    <div className="relative h-full w-full min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0a0f1d]/90 to-[#04060c]/95 shadow-xl backdrop-blur-xl">
      {/* Telemetry Monospace Labels */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
          THREAT MATRIX // VORTEX
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 text-right font-mono">
        <div className="text-3xl font-black tabular-nums tracking-tight text-white">{score}</div>
        <div className="text-[9px] uppercase tracking-widest text-slate-400">RISK INDEX</div>
      </div>

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 3.8]} fov={45} />
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight position={[-5, -5, -3]} color={primaryColor} intensity={0.8} />

        <Float speed={1.5} rotationIntensity={0.6} floatIntensity={0.5}>
          <VortexCore score={score} />
          <OrbitField color={primaryColor} />
        </Float>
      </Canvas>
    </div>
  );
}
