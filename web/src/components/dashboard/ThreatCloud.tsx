import React, { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Sphere, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Analysis } from '@/lib/types';

interface ThreatPointProps {
  position: [number, number, number];
  color: string;
  size: number;
  label: string;
  onClick: () => void;
}

function ThreatPoint({ position, color, size, label, onClick }: ThreatPointProps) {
  const [hovered, setHovered] = React.useState(false);
  const ref = React.useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ref.current) {
      ref.current.scale.setScalar(hovered ? 1.5 : 1);
    }
  });

  return (
    <group position={position}>
      <Sphere
        ref={ref}
        args={[size, 16, 16]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 2 : 0.5}
          roughness={0}
          metalness={1}
        />
      </Sphere>
    </group>
  );
}

function CampaignConnections({ points, campaigns }: { points: any[], campaigns: any[] }) {
  return (
    <group>
      {points.map((p, i) => {
        if (i % 5 === 0 && i + 1 < points.length) {
          const p2 = points[i+1];
          return (
            <line key={`line-${i}`}>
              <bufferGeometry attach="geometry">
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([p.position[0], p.position[1], p.position[2], p2.position[0], p2.position[1], p2.position[2]]), 3] as [THREE.TypedArray, number]}
                />
              </bufferGeometry>
              <lineBasicMaterial attach="material" color="#4f46e5" transparent opacity={0.4} />
            </line>
          );
        }
        return null;
      })}
    </group>
  );
}

export default function ThreatCloud({ analyses }: { analyses: Analysis[] }) {
  const points = useMemo(() => {
    return analyses.map((a, i) => {
      const x = (a.risk_score / 100) * 10 - 5;
      const y = (Math.random() - 0.5) * 5;
      const z = (i / analyses.length) * 10 - 5;

      let color = '#4ade80';
      if (a.risk_level === 'medium') color = '#facc15';
      if (a.risk_level === 'high') color = '#fb923c';
      if (a.risk_level === 'critical') color = '#ef4444';

      return {
        position: [x, y, z] as [number, number, number],
        color,
        size: a.risk_level === 'critical' ? 0.15 : 0.1,
        label: a.threat_type,
      };
    });
  }, [analyses]);

  return (
    <div className="h-full w-full bg-black/20 rounded-3xl overflow-hidden border border-white/10">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 15]} />
        <OrbitControls enablePan={false} minDistance={5} maxDistance={25} />

        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} color="#4f46e5" intensity={0.5} />

        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
          <group>
            {points.map((p, i) => (
              <ThreatPoint
                key={i}
                {...p}
                onClick={() => console.log(`Analysis ${i} clicked`)}
              />
            ))}
            <CampaignConnections points={points} campaigns={[]} />
          </group>
        </Float>

        <group>
          {Array.from({ length: 100 }).map((_, i) => (
            <Sphere
              key={i}
              args={[0.02, 8, 8]}
              position={[
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40
              ]}
            >
              <meshBasicMaterial color="#ffffff" opacity={Math.random() * 0.5} transparent />
            </Sphere>
          ))}
        </group>
      </Canvas>
    </div>
  );
}
