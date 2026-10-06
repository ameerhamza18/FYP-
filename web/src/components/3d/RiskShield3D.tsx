'use client';

import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';

function MechanicalShieldMesh({
  score,
  level,
}: {
  score: number;
  level: string;
}) {
  const outerRingRef = useRef<THREE.Group>(null);
  const midRingRef = useRef<THREE.Group>(null);
  const shieldCoreRef = useRef<THREE.Mesh>(null);
  const gemRef = useRef<THREE.Mesh>(null);

  const isCritical = score >= 75 || level.toUpperCase().includes('CRITICAL') || level.toUpperCase().includes('BULAND');
  const primaryGlow = isCritical ? '#ef4444' : '#38bdf8';
  const rimColor = isCritical ? '#7f1d1d' : '#0369a1';

  useFrame((_, delta) => {
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * 0.35;
    }
    if (midRingRef.current) {
      midRingRef.current.rotation.z -= delta * 0.45;
    }
    if (shieldCoreRef.current) {
      shieldCoreRef.current.rotation.y = Math.sin(Date.now() * 0.0015) * 0.25;
      shieldCoreRef.current.rotation.x = Math.cos(Date.now() * 0.0012) * 0.12;
    }
    if (gemRef.current) {
      const pulse = 1.0 + Math.sin(Date.now() * 0.004) * 0.08;
      gemRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Outer Rotating Calibrated HUD Ring */}
      <group ref={outerRingRef}>
        <mesh>
          <ringGeometry args={[1.9, 2.05, 48]} />
          <meshBasicMaterial color={primaryGlow} transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
        {/* Ring tick segments */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 1.98, Math.sin(angle) * 1.98, 0.02]}
              rotation={[0, 0, angle]}
            >
              <boxGeometry args={[0.08, 0.02, 0.02]} />
              <meshBasicMaterial color={primaryGlow} />
            </mesh>
          );
        })}
      </group>

      {/* Middle Counter-Rotating Telemetry Ring */}
      <group ref={midRingRef}>
        <mesh>
          <ringGeometry args={[1.65, 1.75, 36]} />
          <meshBasicMaterial color={primaryGlow} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 3D Mechanical Shield Armor Body */}
      <group ref={shieldCoreRef}>
        {/* Outer Heavy Metallic Bezel */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[1.35, 1.45, 0.28, 6]} />
          <meshStandardMaterial
            color="#111827"
            metalness={0.92}
            roughness={0.2}
            envMapIntensity={1.5}
          />
        </mesh>

        {/* Cyber Neon Trim Line */}
        <mesh position={[0, 0, 0.14]}>
          <cylinderGeometry args={[1.3, 1.3, 0.04, 6]} />
          <meshBasicMaterial color={primaryGlow} transparent opacity={0.8} />
        </mesh>

        {/* Inner Heavy Dark Plate */}
        <mesh position={[0, 0, 0.16]}>
          <cylinderGeometry args={[1.15, 1.25, 0.15, 6]} />
          <meshStandardMaterial
            color="#090d16"
            metalness={0.95}
            roughness={0.15}
          />
        </mesh>

        {/* Central Ruby Faceted Gem Core */}
        <mesh ref={gemRef} position={[0, 0, 0.25]} rotation={[0, 0, Math.PI / 6]}>
          <octahedronGeometry args={[0.7, 0]} />
          <meshPhysicalMaterial
            color={primaryGlow}
            emissive={primaryGlow}
            emissiveIntensity={isCritical ? 1.8 : 1.2}
            roughness={0.15}
            metalness={0.4}
            transmission={0.65}
            thickness={0.8}
            reflectivity={0.9}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Central Digital Score Label */}
        <Html position={[0, 0, 0.45]} center distanceFactor={7} zIndexRange={[50, 0]}>
          <div className="pointer-events-none flex flex-col items-center justify-center select-none">
            <span
              className="font-mono text-3xl font-extrabold tracking-tight drop-shadow-md"
              style={{
                color: '#ffffff',
                textShadow: `0 0 16px ${primaryGlow}`,
              }}
            >
              {score}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/70">
              CORE INDEX
            </span>
          </div>
        </Html>
      </group>
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
    <div className={`relative h-64 w-full flex items-center justify-center overflow-hidden rounded-xl ${className}`}>
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: `radial-gradient(circle at center, ${score >= 70 ? '#ef4444' : '#38bdf8'} 0%, transparent 65%)`,
        }}
      />

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={42} />
        <ambientLight intensity={0.7} />
        <pointLight position={[0, 2, 4]} intensity={2.0} color={score >= 70 ? '#fca5a5' : '#7dd3fc'} />
        <directionalLight position={[3, 4, 2]} intensity={1.5} />
        <directionalLight position={[-3, -4, 2]} intensity={0.8} color="#1e293b" />

        <MechanicalShieldMesh score={score} level={level} />
      </Canvas>
    </div>
  );
}
