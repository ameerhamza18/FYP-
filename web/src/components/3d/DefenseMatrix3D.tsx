'use client';

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// 1. Sentinel Crystalline Defense Core with Inner Quantum Kernel
function SentinelCore({ pointer, isScanning }: { pointer: React.MutableRefObject<[number, number]>; isScanning: boolean }) {
  const outerMeshRef = useRef<THREE.Mesh>(null);
  const innerMeshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const gimbalYawRef = useRef<THREE.Group>(null);
  const gimbalPitchRef = useRef<THREE.Group>(null);
  const gimbalRollRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const speedMultiplier = isScanning ? 2.5 : 1.0;

    // Smooth continuous multi-axis rotation
    if (outerMeshRef.current) {
      outerMeshRef.current.rotation.y += delta * 0.35 * speedMultiplier;
      outerMeshRef.current.rotation.x += delta * 0.18 * speedMultiplier;

      // Mouse parallax tilt lerp
      outerMeshRef.current.rotation.y = THREE.MathUtils.lerp(
        outerMeshRef.current.rotation.y,
        outerMeshRef.current.rotation.y + pointer.current[0] * 0.08,
        0.05
      );
      outerMeshRef.current.rotation.x = THREE.MathUtils.lerp(
        outerMeshRef.current.rotation.x,
        pointer.current[1] * 0.35,
        0.05
      );
    }

    // Inner core counter-rotation
    if (innerMeshRef.current) {
      innerMeshRef.current.rotation.y -= delta * 0.6 * speedMultiplier;
      innerMeshRef.current.rotation.z += delta * 0.4 * speedMultiplier;
      const s = 1.0 + Math.sin(Date.now() * 0.003) * 0.06;
      innerMeshRef.current.scale.set(s, s, s);
    }

    if (wireframeRef.current) {
      wireframeRef.current.rotation.y -= delta * 0.25;
      wireframeRef.current.rotation.x += delta * 0.15;
    }

    // Concentric Gyroscopic Sensor Gimbals
    if (gimbalYawRef.current) {
      gimbalYawRef.current.rotation.z += delta * 0.22 * speedMultiplier;
    }
    if (gimbalPitchRef.current) {
      gimbalPitchRef.current.rotation.x -= delta * 0.28 * speedMultiplier;
    }
    if (gimbalRollRef.current) {
      gimbalRollRef.current.rotation.y += delta * 0.32 * speedMultiplier;
    }
  });

  return (
    <group>
      {/* Outer Faceted Crystalline Shell */}
      <mesh ref={outerMeshRef}>
        <icosahedronGeometry args={[1.05, 0]} />
        <meshPhysicalMaterial
          color="#0f2b5c"
          emissive="#1d4ed8"
          emissiveIntensity={isScanning ? 1.2 : 0.65}
          roughness={0.1}
          metalness={0.85}
          reflectivity={0.95}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* Inner Pulsing Quantum Kernel */}
      <mesh ref={innerMeshRef}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial color={isScanning ? '#38bdf8' : '#60a5fa'} wireframe />
      </mesh>

      {/* Outer Holographic Tessellation Grid */}
      <lineSegments ref={wireframeRef}>
        <wireframeGeometry args={[new THREE.IcosahedronGeometry(1.28, 1)]} />
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.3} />
      </lineSegments>

      {/* Gimbal 1: Horizontal Radar Orbit */}
      <group ref={gimbalYawRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.65, 1.68, 64]} />
          <meshBasicMaterial color="#3b82f6" side={THREE.DoubleSide} transparent opacity={0.5} />
        </mesh>
        {/* Radar tick satellites */}
        <mesh position={[1.66, 0, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#60a5fa" />
        </mesh>
        <mesh position={[-1.66, 0, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#60a5fa" />
        </mesh>
      </group>

      {/* Gimbal 2: Inclined Sensor Perimeter */}
      <group ref={gimbalPitchRef}>
        <mesh rotation={[Math.PI / 4, 0, Math.PI / 6]}>
          <ringGeometry args={[1.86, 1.89, 64]} />
          <meshBasicMaterial color="#0284c7" side={THREE.DoubleSide} transparent opacity={0.35} />
        </mesh>
      </group>

      {/* Gimbal 3: Outer Telemetry Containment */}
      <group ref={gimbalRollRef}>
        <mesh rotation={[0, Math.PI / 3, Math.PI / 4]}>
          <ringGeometry args={[2.08, 2.11, 64]} />
          <meshBasicMaterial color="#818cf8" side={THREE.DoubleSide} transparent opacity={0.25} />
        </mesh>
      </group>
    </group>
  );
}

// 2. Deterministic Telemetry Constellation with Optical Nodes
function TelemetryConstellation() {
  const points = useMemo(() => {
    const pts = [];
    const count = 42;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 2.3 + ((i % 6) * 0.12);
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
      groupRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      {points.map((pt, i) => (
        <mesh key={i} position={pt}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshBasicMaterial
            color={i % 3 === 0 ? '#38bdf8' : i % 5 === 0 ? '#34d399' : '#60a5fa'}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function DefenseMatrix3D() {
  const pointer = useRef<[number, number]>([0, 0]);
  const [isScanning, setIsScanning] = useState(false);
  const [pulseCount, setPulseCount] = useState(148);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.current = [x, y];
  };

  const handleMouseLeave = () => {
    pointer.current = [0, 0];
  };

  const triggerDefensivePulse = () => {
    setIsScanning(true);
    setPulseCount((prev) => prev + 1);
    setTimeout(() => setIsScanning(false), 1200);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={triggerDefensivePulse}
      className="group relative h-[440px] w-full select-none overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#060a14] via-[#080d1c] to-[#04060d] p-1 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-brand/40"
      title="Click anywhere to trigger a high-frequency sensor ping"
    >
      {/* Background Micro Grid */}
      <div className="tl-cyber-grid pointer-events-none absolute inset-0 opacity-40" />

      {/* Decorative Technical HUD Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 font-mono text-[10px] tracking-wider text-slate-400">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-bold tracking-widest text-slate-200">
              SENTINEL CORE // {isScanning ? 'PULSE DISCHARGE' : 'ARMED'}
            </span>
          </div>
          <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-slate-400">
            FREQ: 2.44 GHz
          </span>
        </div>

        {/* Center Crosshairs & Telemetry */}
        <div className="flex items-center justify-between text-[9px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 bg-brand" />
            CIPHER: AES-256-GCM
          </span>
          <span className="font-semibold text-slate-400">
            RADAR PINGS: <span className="tabular-nums text-emerald-400">{pulseCount}</span>
          </span>
        </div>

        {/* Bottom Telemetry Strip */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[10px]">
          <span className="text-slate-400">NODE ID: TL-CORE-ALPHA-01</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-slate-500">TAP TO DISCHARGE</span>
            <span className="rounded bg-brand/20 border border-brand/40 px-2 py-0.5 font-bold text-brand">
              3D ACTIVE SENSOR
            </span>
          </div>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <Canvas
        className="h-full w-full cursor-grab active:cursor-grabbing"
        gl={{ antialias: true, alpha: true }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5.2]} fov={45} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 8, 5]} intensity={1.6} color="#93c5fd" />
        <pointLight position={[-5, -4, -2]} intensity={1.2} color="#3b82f6" />
        <pointLight position={[3, -3, 3]} intensity={0.9} color="#10b981" />

        <Float speed={1.6} rotationIntensity={0.35} floatIntensity={0.4}>
          <SentinelCore pointer={pointer} isScanning={isScanning} />
          <TelemetryConstellation />
        </Float>
      </Canvas>
    </div>
  );
}

