'use client';

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

function SentinelCore({
  pointer,
  isScanning,
}: {
  pointer: React.MutableRefObject<[number, number]>;
  isScanning: boolean;
}) {
  const outerMeshRef = useRef<THREE.Mesh>(null);
  const innerMeshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const gimbalYawRef = useRef<THREE.Group>(null);
  const gimbalPitchRef = useRef<THREE.Group>(null);
  const gimbalRollRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const speedMultiplier = isScanning ? 2.4 : 1.0;

    if (outerMeshRef.current) {
      outerMeshRef.current.rotation.y += delta * 0.32 * speedMultiplier;
      outerMeshRef.current.rotation.x += delta * 0.16 * speedMultiplier;

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

    if (innerMeshRef.current) {
      innerMeshRef.current.rotation.y -= delta * 0.55 * speedMultiplier;
      innerMeshRef.current.rotation.z += delta * 0.38 * speedMultiplier;
      const s = 1.0 + Math.sin(Date.now() * 0.003) * 0.06;
      innerMeshRef.current.scale.set(s, s, s);
    }

    if (wireframeRef.current) {
      wireframeRef.current.rotation.y -= delta * 0.22;
      wireframeRef.current.rotation.x += delta * 0.14;
    }

    if (gimbalYawRef.current) {
      gimbalYawRef.current.rotation.z += delta * 0.2 * speedMultiplier;
    }
    if (gimbalPitchRef.current) {
      gimbalPitchRef.current.rotation.x -= delta * 0.26 * speedMultiplier;
    }
    if (gimbalRollRef.current) {
      gimbalRollRef.current.rotation.y += delta * 0.3 * speedMultiplier;
    }
  });

  return (
    <group>
      {/* Faceted Ceramic-Glass Sentinel Core */}
      <mesh ref={outerMeshRef}>
        <icosahedronGeometry args={[1.04, 0]} />
        <meshPhysicalMaterial
          color="#7c6dfa"
          emissive="#8b3dff"
          emissiveIntensity={isScanning ? 0.65 : 0.24}
          roughness={0.16}
          metalness={0.28}
          reflectivity={0.9}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Inner Pulsing Forensic Kernel */}
      <mesh ref={innerMeshRef}>
        <octahedronGeometry args={[0.54, 0]} />
        <meshBasicMaterial color={isScanning ? '#158067' : '#5b21b6'} wireframe />
      </mesh>

      {/* Outer Tessellation Lattice */}
      <lineSegments ref={wireframeRef}>
        <wireframeGeometry args={[new THREE.IcosahedronGeometry(1.28, 1)]} />
        <lineBasicMaterial color="#8b3dff" transparent opacity={0.28} />
      </lineSegments>

      {/* Gimbal 1: Horizontal Orbit */}
      <group ref={gimbalYawRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.64, 1.67, 64]} />
          <meshBasicMaterial color="#8b3dff" side={THREE.DoubleSide} transparent opacity={0.42} />
        </mesh>
        <mesh position={[1.65, 0, 0]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshBasicMaterial color="#158067" />
        </mesh>
        <mesh position={[-1.65, 0, 0]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshBasicMaterial color="#8b3dff" />
        </mesh>
      </group>

      {/* Gimbal 2: Inclined Sensor Perimeter */}
      <group ref={gimbalPitchRef}>
        <mesh rotation={[Math.PI / 4, 0, Math.PI / 6]}>
          <ringGeometry args={[1.86, 1.89, 64]} />
          <meshBasicMaterial color="#158067" side={THREE.DoubleSide} transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Gimbal 3: Outer Containment */}
      <group ref={gimbalRollRef}>
        <mesh rotation={[0, Math.PI / 3, Math.PI / 4]}>
          <ringGeometry args={[2.06, 2.09, 64]} />
          <meshBasicMaterial color="#d9820b" side={THREE.DoubleSide} transparent opacity={0.26} />
        </mesh>
      </group>
    </group>
  );
}

function TelemetryConstellation() {
  const points = useMemo(() => {
    const pts = [];
    const count = 42;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 2.3 + (i % 6) * 0.12;
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
          <sphereGeometry args={[0.026, 8, 8]} />
          <meshBasicMaterial
            color={i % 3 === 0 ? '#8b3dff' : i % 5 === 0 ? '#158067' : '#6366f1'}
            transparent
            opacity={0.7}
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
      className="group relative h-[410px] w-full select-none overflow-hidden rounded-[28px] border border-border-default bg-gradient-to-br from-[#FFFFFF] via-[#EEF1FE] to-[#F6ECE2] p-1 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-lift)] dark:from-[#1E1E24] dark:via-[#232233] dark:to-[#191920]"
      title="Click anywhere to trigger a sensor verification pulse"
    >
      {/* Subtle Studio Grid */}
      <div className="tl-cyber-dots pointer-events-none absolute inset-0 opacity-45" />

      {/* Editorial Studio HUD Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 text-[11px] text-muted">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface/90 px-3.5 py-1.5 shadow-2xs backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#158067] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#158067]" />
            </span>
            <span className="font-semibold text-foreground">
              Sentinel Core · {isScanning ? 'Pulse Active' : 'Armed'}
            </span>
          </div>
          <span className="rounded-full border border-border-default bg-surface/85 px-3 py-1 text-[11px] font-medium text-muted backdrop-blur-md">
            2.44 GHz
          </span>
        </div>

        {/* Center Subtle Badges */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="rounded-full bg-surface/75 px-2.5 py-1 font-medium text-muted backdrop-blur-sm">
            AES-256-GCM
          </span>
          <span className="rounded-full bg-surface/85 px-3 py-1 font-semibold text-foreground shadow-2xs backdrop-blur-sm">
            Pings <span className="ml-1 tabular-nums text-[#158067]">{pulseCount}</span>
          </span>
        </div>

        {/* Bottom Strip */}
        <div className="flex items-center justify-between border-t border-border-default/70 pt-3 text-[11px]">
          <span className="font-medium text-muted">Node · TL-Core-Alpha</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-muted">Tap to pulse</span>
            <span className="rounded-full bg-brand px-3 py-1 text-[10px] font-semibold text-brand-foreground shadow-2xs">
              3D Live Sensor
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
        <ambientLight intensity={1.15} />
        <directionalLight position={[6, 8, 5]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-5, -4, -2]} intensity={1.1} color="#8b3dff" />
        <pointLight position={[3, -3, 3]} intensity={0.85} color="#158067" />

        <Float speed={1.6} rotationIntensity={0.35} floatIntensity={0.4}>
          <SentinelCore pointer={pointer} isScanning={isScanning} />
          <TelemetryConstellation />
        </Float>
      </Canvas>
    </div>
  );
}
