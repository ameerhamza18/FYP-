'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';

function ShieldSculpture({
  score,
  level,
}: {
  score: number;
  level: string;
}) {
  const outerRingRef = useRef<THREE.Group>(null);
  const midRingRef = useRef<THREE.Group>(null);
  const gemRef = useRef<THREE.Mesh>(null);

  const isCritical =
    score >= 70 ||
    level.toUpperCase().includes('CRITICAL') ||
    level.toUpperCase().includes('BULAND');
  const primaryGlow = isCritical ? '#D9383A' : score >= 40 ? '#D9820B' : '#8B3DFF';

  useFrame((_, delta) => {
    if (outerRingRef.current) outerRingRef.current.rotation.z += delta * 0.3;
    if (midRingRef.current) midRingRef.current.rotation.z -= delta * 0.4;
    if (gemRef.current) {
      gemRef.current.rotation.y += delta * 0.35;
      const pulse = 1.0 + Math.sin(Date.now() * 0.003) * 0.05;
      gemRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <group ref={outerRingRef}>
        <mesh>
          <ringGeometry args={[1.82, 1.9, 48]} />
          <meshBasicMaterial color={primaryGlow} transparent opacity={0.28} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group ref={midRingRef}>
        <mesh>
          <ringGeometry args={[1.5, 1.56, 36]} />
          <meshBasicMaterial color="#CBD4FA" transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <mesh ref={gemRef} position={[0, 0, 0.1]} rotation={[0, 0, Math.PI / 6]}>
        <icosahedronGeometry args={[0.92, 0]} />
        <meshPhysicalMaterial
          color={primaryGlow}
          emissive={primaryGlow}
          emissiveIntensity={0.35}
          roughness={0.18}
          metalness={0.25}
          clearcoat={1}
          transparent
          opacity={0.9}
        />
      </mesh>

      <Html position={[0, 0, 0.5]} center distanceFactor={7} zIndexRange={[50, 0]}>
        <div className="pointer-events-none flex flex-col items-center justify-center select-none rounded-2xl bg-surface/90 px-3 py-1.5 shadow-md backdrop-blur-md border border-border-default">
          <span className="text-2xl font-extrabold tabular-nums text-foreground">
            {score}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted">
            Peak Index
          </span>
        </div>
      </Html>
    </group>
  );
}

export default function RiskShield3D({
  score = 84,
  level = 'BULAND',
  className = '',
}: {
  score?: number;
  level?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative h-52 w-full flex items-center justify-center overflow-hidden rounded-2xl bg-surface-muted/70 border border-border-default ${className}`}
    >
      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={42} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 4, 3]} intensity={1.4} />
        <ShieldSculpture score={score} level={level} />
      </Canvas>
    </div>
  );
}
