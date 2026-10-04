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
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const innerWireRef = useRef<THREE.LineSegments>(null);

  // Map score to visual color tones
  const color = useMemo(() => {
    if (score < 30) return '#10b981'; // Low - Emerald
    if (score < 60) return '#f59e0b'; // Medium - Amber
    if (score < 85) return '#f97316'; // High - Orange
    return '#ef4444'; // Critical - Crimson
  }, [score]);

  const distortion = useMemo(() => {
    return 0.12 + (score / 100) * 0.48;
  }, [score]);

  const speed = useMemo(() => {
    return 0.8 + (score / 100) * 2.5;
  }, [score]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4 * speed;
      meshRef.current.rotation.z += delta * 0.2 * speed;
    }
    if (innerWireRef.current) {
      innerWireRef.current.rotation.y -= delta * 0.3 * speed;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z -= delta * 0.45;
      ring1Ref.current.rotation.x += delta * 0.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += delta * 0.35;
      ring2Ref.current.rotation.z += delta * 0.15;
    }
  });

  return (
    <group>
      {/* Dynamic Reactive Fluidic Core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.95, 48, 48]} />
        <MeshDistortMaterial
          color={color}
          speed={speed}
          distort={distortion}
          radius={0.95}
          emissive={color}
          emissiveIntensity={0.5 + (score / 100) * 0.8}
          roughness={0.15}
          metalness={0.85}
          reflectivity={0.9}
        />
      </mesh>

      {/* Inner Wireframe Core */}
      <lineSegments ref={innerWireRef}>
        <wireframeGeometry args={[new THREE.IcosahedronGeometry(0.7, 1)]} />
        <lineBasicMaterial color={color} transparent opacity={0.4} />
      </lineSegments>

      {/* Primary Containment Gimbal Ring */}
      <group ref={ring1Ref}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.38, 1.42, 64]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.45} />
        </mesh>
      </group>

      {/* Secondary Tilted Sensor Ring */}
      <group ref={ring2Ref}>
        <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
          <ringGeometry args={[1.56, 1.59, 64]} />
          <meshBasicMaterial color="#94a3b8" side={THREE.DoubleSide} transparent opacity={0.2} />
        </mesh>
      </group>
    </group>
  );
}

// Orbital Telemetry Particle Field
function OrbitField({ color }: { color: string }) {
  const particles = useMemo(() => {
    const pts = [];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 1.75 + ((i % 5) * 0.12);
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
          <meshBasicMaterial color={color} transparent opacity={0.65} />
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

  const classification = useMemo(() => {
    if (score < 30) return 'LOW THREAT LEVEL';
    if (score < 60) return 'MODERATE SUSPICION';
    if (score < 85) return 'HIGH RISK DETECTED';
    return 'CRITICAL SEVERITY';
  }, [score]);

  return (
    <div className="relative h-full w-full min-h-[260px] select-none overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#060a14] via-[#091022] to-[#04060d] shadow-xl backdrop-blur-xl">
      {/* Cyber Grid background */}
      <div className="tl-cyber-grid pointer-events-none absolute inset-0 opacity-25" />

      {/* Telemetry Monospace Labels */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 font-mono text-[10px] tracking-wider text-slate-300">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full tl-beacon" style={{ backgroundColor: primaryColor }} />
          <span className="font-bold">CONTAINMENT FIELD // 3D VORTEX</span>
        </span>
        <div className="text-[9px] text-slate-500 mt-0.5">{classification}</div>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 text-right font-mono">
        <div className="text-3xl font-black tabular-nums tracking-tight text-white">{score}</div>
        <div className="text-[9px] uppercase tracking-widest text-slate-400">RISK INDEX</div>
      </div>

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 4.0]} fov={45} />
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={1.3} />
        <pointLight position={[-5, -5, -3]} color={primaryColor} intensity={0.9} />

        <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.4}>
          <VortexCore score={score} />
          <OrbitField color={primaryColor} />
        </Float>
      </Canvas>
    </div>
  );
}

