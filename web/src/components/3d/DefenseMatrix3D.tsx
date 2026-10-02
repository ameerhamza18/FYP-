'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// 1. Crystalline 3D Shield Core
function CrystallineCore({ pointer }: { pointer: React.MutableRefObject<[number, number]> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.LineSegments>(null);
  const outerRingRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      // Smooth continuous rotation
      meshRef.current.rotation.y += delta * 0.4;
      meshRef.current.rotation.x += delta * 0.2;

      // Mouse parallax tilt lerp
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        meshRef.current.rotation.y + pointer.current[0] * 0.05,
        0.05
      );
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        pointer.current[1] * 0.3,
        0.05
      );
    }

    if (wireRef.current) {
      wireRef.current.rotation.y -= delta * 0.25;
      wireRef.current.rotation.z += delta * 0.15;
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * 0.3;
      outerRingRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;
    }
  });

  return (
    <group>
      {/* Central Faceted Core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.1, 0]} />
        <meshPhysicalMaterial
          color="#1e3a8a"
          emissive="#2563eb"
          emissiveIntensity={0.6}
          roughness={0.15}
          metalness={0.9}
          reflectivity={0.9}
          clearcoat={1}
          clearcoatRoughness={0.1}
          wireframe={false}
        />
      </mesh>

      {/* Holographic Wireframe Shield Layer */}
      <lineSegments ref={wireRef}>
        <wireframeGeometry args={[new THREE.IcosahedronGeometry(1.35, 1)]} />
        <lineBasicMaterial color="#60a5fa" transparent opacity={0.35} />
      </lineSegments>

      {/* Gyroscopic Orbital Defense Rings */}
      <group ref={outerRingRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7, 1.74, 64]} />
          <meshBasicMaterial color="#3b82f6" side={THREE.DoubleSide} transparent opacity={0.4} />
        </mesh>
        <mesh rotation={[0, Math.PI / 3, 0]}>
          <ringGeometry args={[1.9, 1.93, 64]} />
          <meshBasicMaterial color="#93c5fd" side={THREE.DoubleSide} transparent opacity={0.25} />
        </mesh>
      </group>
    </group>
  );
}

// 2. Deterministic Telemetry Particle Constellation (no hydration mismatch)
function TelemetryConstellation() {
  const points = useMemo(() => {
    const pts = [];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 2.2 + ((i % 5) * 0.1);
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
      groupRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {points.map((pt, i) => (
        <mesh key={i} position={pt}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color={i % 4 === 0 ? '#60a5fa' : '#38bdf8'} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export default function DefenseMatrix3D() {
  const pointer = useRef<[number, number]>([0, 0]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.current = [x, y];
  };

  const handleMouseLeave = () => {
    pointer.current = [0, 0];
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative h-[420px] w-full select-none overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050811]/95 p-1 shadow-2xl backdrop-blur-2xl"
    >
      {/* Decorative Technical HUD Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 font-mono text-[10px] tracking-wider text-slate-400">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-semibold text-slate-200">DEFENSE MATRIX // ARMED</span>
          </div>
          <span className="text-slate-400">FREQ: 2.44 GHz</span>
        </div>

        {/* Center Crosshairs */}
        <div className="flex items-center justify-between text-[9px] text-slate-500">
          <span>LATENCY: 142ms</span>
          <span>INTEGRITY: 99.98%</span>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px]">
          <span className="text-slate-400">NODE ID: TL-CORE-ALPHA</span>
          <span className="rounded bg-brand/20 px-2 py-0.5 font-bold text-brand">3D ACTIVE SENSOR</span>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <Canvas
        className="h-full w-full cursor-grab active:cursor-grabbing"
        gl={{ antialias: true, alpha: true }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} color="#93c5fd" />
        <pointLight position={[-4, -4, -2]} intensity={1.0} color="#3b82f6" />
        <pointLight position={[3, -2, 2]} intensity={0.8} color="#10b981" />

        <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.5}>
          <CrystallineCore pointer={pointer} />
          <TelemetryConstellation />
        </Float>
      </Canvas>
    </div>
  );
}
