import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface RiskVortexProps {
  score: number; // 0 to 100
}

function VortexCore({ score }: { score: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Map score to visual properties
  const color = useMemo(() => {
    if (score < 30) return '#4ade80'; // Low - Green
    if (score < 60) return '#facc15'; // Medium - Yellow
    if (score < 80) return '#fb923c'; // High - Orange
    return '#ef4444'; // Critical - Red
  }, [score]);

  const distortion = useMemo(() => {
    // More risk = more distortion/instability
    return (score / 100) * 0.6;
  }, [score]);

  const speed = useMemo(() => {
    // More risk = faster rotation/pulse
    return 0.5 + (score / 100) * 2;
  }, [score]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01 * speed;
      meshRef.current.rotation.z += 0.005 * speed;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <MeshDistortMaterial
        color={color}
        speed={speed}
        distort={distortion}
        radius={1}
        emissive={color}
        emissiveIntensity={0.5 + (score / 100)}
        roughness={0.1}
        metalness={0.8}
      />
    </Sphere>
  );
}

export default function RiskVortex({ score }: RiskVortexProps) {
  return (
    <div className="h-full w-full min-h-[300px] bg-black/40 rounded-3xl overflow-hidden border border-white/10 relative">
      <div className="absolute top-4 left-4 z-10">
        <span className="text-[10px] uppercase tracking-widest text-muted font-bold">Risk Core</span>
      </div>
      <div className="absolute bottom-4 right-4 z-10 text-right">
        <span className="text-4xl font-black tabular-nums text-white">{score}</span>
        <span className="ml-2 text-xs text-muted uppercase font-bold">Score</span>
      </div>

      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 4]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1} />
        <pointLight position={[-5, -5, -5]} color="#4f46e5" intensity={0.5} />

        <Float speed={2} rotationIntensity={1} floatIntensity={1}>
          <VortexCore score={score} />
        </Float>

        {/* Atmospheric particles around the core */}
        <group>
          {Array.from({ length: 40 }).map((_, i) => (
            <Sphere key={i} args={[0.015, 8, 8]} position={[
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 4
            ]}>
              <meshBasicMaterial color={score > 70 ? '#ef4444' : '#ffffff'} transparent opacity={0.3} />
            </Sphere>
          ))}
        </group>
      </Canvas>
    </div>
  );
}
