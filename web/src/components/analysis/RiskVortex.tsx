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

  const color = useMemo(() => {
    if (score < 30) return '#158067';
    if (score < 60) return '#d9820b';
    if (score < 80) return '#d95d1e';
    return '#d9383a';
  }, [score]);

  const distortion = useMemo(() => 0.12 + (score / 100) * 0.44, [score]);
  const speed = useMemo(() => 0.8 + (score / 100) * 2.2, [score]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.38 * speed;
      meshRef.current.rotation.z += delta * 0.18 * speed;
    }
    if (innerWireRef.current) {
      innerWireRef.current.rotation.y -= delta * 0.28 * speed;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z -= delta * 0.42;
      ring1Ref.current.rotation.x += delta * 0.18;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += delta * 0.32;
      ring2Ref.current.rotation.z += delta * 0.14;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.94, 48, 48]} />
        <MeshDistortMaterial
          color={color}
          speed={speed}
          distort={distortion}
          radius={0.94}
          emissive={color}
          emissiveIntensity={0.22 + (score / 100) * 0.35}
          roughness={0.2}
          metalness={0.3}
          reflectivity={0.85}
        />
      </mesh>

      <lineSegments ref={innerWireRef}>
        <wireframeGeometry args={[new THREE.IcosahedronGeometry(0.7, 1)]} />
        <lineBasicMaterial color={color} transparent opacity={0.35} />
      </lineSegments>

      <group ref={ring1Ref}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.38, 1.42, 64]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.42} />
        </mesh>
      </group>

      <group ref={ring2Ref}>
        <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
          <ringGeometry args={[1.56, 1.59, 64]} />
          <meshBasicMaterial color="#8b3dff" side={THREE.DoubleSide} transparent opacity={0.22} />
        </mesh>
      </group>
    </group>
  );
}

function OrbitField({ color }: { color: string }) {
  const particles = useMemo(() => {
    const pts = [];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 1.75 + (i % 5) * 0.12;
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
      groupRef.current.rotation.y += delta * 0.14;
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((pt, i) => (
        <mesh key={i} position={pt}>
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export default function RiskVortex({ score }: RiskVortexProps) {
  const primaryColor = useMemo(() => {
    if (score < 30) return '#158067';
    if (score < 60) return '#d9820b';
    if (score < 80) return '#d95d1e';
    return '#d9383a';
  }, [score]);

  const classification = useMemo(() => {
    if (score < 30) return 'Safe · Low Risk';
    if (score < 60) return 'Moderate Caution';
    if (score < 80) return 'High Risk';
    return 'Critical Scam';
  }, [score]);

  return (
    <div className="relative h-full w-full min-h-[250px] select-none overflow-hidden rounded-[24px] border border-border-default bg-gradient-to-br from-[#FAF9F5] via-[#EEF1FE]/65 to-[#F6ECE2] shadow-2xs dark:from-[#1B1B22] dark:via-[#222130] dark:to-[#17171D]">
      <div className="tl-cyber-dots pointer-events-none absolute inset-0 opacity-40" />

      <div className="pointer-events-none absolute left-3.5 top-3.5 z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface/90 px-3 py-1 text-[10px] font-semibold text-foreground shadow-2xs backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          {classification}
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-3.5 right-3.5 z-10 rounded-2xl border border-border-default bg-surface/90 px-3 py-1.5 text-right shadow-2xs backdrop-blur-sm">
        <div className="tl-serif text-3xl leading-none tabular-nums text-foreground">{score}</div>
        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
          Risk Index
        </div>
      </div>

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 4.0]} fov={45} />
        <ambientLight intensity={1.1} />
        <pointLight position={[5, 5, 5]} intensity={1.35} color="#ffffff" />
        <pointLight position={[-5, -5, -3]} color={primaryColor} intensity={0.9} />

        <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.4}>
          <VortexCore score={score} />
          <OrbitField color={primaryColor} />
        </Float>
      </Canvas>
    </div>
  );
}
