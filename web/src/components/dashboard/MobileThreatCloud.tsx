import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Float, Sphere, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Analysis } from '@/lib/types';

interface MobileThreatPointProps {
  position: [number, number, number];
  color: string;
  size: number;
  label: string;
  onClick: () => void;
}

function MobileThreatPoint({ position, color, size, label, onClick }: MobileThreatPointProps) {
  return (
    <group position={position}>
      <Sphere
        args={[size, 16, 16]}
        onClick={onClick}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          roughness={0}
          metalness={1}
        />
      </Sphere>
    </group>
  );
}

export default function MobileThreatCloud({ analyses }: { analyses: Analysis[] }) {
  const points = useMemo(() => {
    return analyses.map((a, i) => {
      const x = (a.risk_score / 100) * 6 - 3;
      const y = (Math.random() - 0.5) * 4;
      const z = (i / analyses.length) * 6 - 3;

      let color = '#4ade80';
      if (a.risk_level === 'medium') color = '#facc15';
      if (a.risk_level === 'high') color = '#fb923c';
      if (a.risk_level === 'critical') color = '#ef4444';

      return {
        position: [x, y, z] as [number, number, number],
        color,
        size: a.risk_level === 'critical' ? 0.12 : 0.08,
        label: a.threat_type,
      };
    });
  }, [analyses]);

  return (
    <div className="h-[400px] w-full bg-black/60 rounded-2xl overflow-hidden border border-white/10 relative">
      <div className="absolute top-3 left-3 z-10">
        <span className="text-[10px] uppercase tracking-widest text-muted font-bold opacity-60">Mobile Threat View</span>
      </div>
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={15} />

        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        <Float speed={1} rotationIntensity={0.2} floatIntensity={0.2}>
          <group>
            {points.map((p, i) => (
              <MobileThreatPoint
                key={i}
                {...p}
                onClick={() => console.log(`Mobile Analysis ${i} clicked`)}
              />
            ))}
          </group>
        </Float>

        <group>
          {Array.from({ length: 50 }).map((_, i) => (
            <Sphere
              key={i}
              args={[0.01, 8, 8]}
              position={[
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
              ]}
            >
              <meshBasicMaterial color="#ffffff" opacity={0.2} transparent />
            </Sphere>
          ))}
        </group>
      </Canvas>
    </div>
  );
}
