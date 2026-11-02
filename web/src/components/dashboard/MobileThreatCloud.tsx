import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Float, Sphere, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import type { Analysis } from '@/lib/types';

interface MobileThreatPointProps {
  position: [number, number, number];
  color: string;
  size: number;
  label: string;
  onClick: () => void;
}

function MobileThreatPoint({ position, color, size, onClick }: MobileThreatPointProps) {
  return (
    <group position={position}>
      <Sphere args={[size, 16, 16]} onClick={onClick}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.2}
          metalness={0.3}
        />
      </Sphere>
    </group>
  );
}

export default function MobileThreatCloud({ analyses }: { analyses: Analysis[] }) {
  const points = useMemo(() => {
    return analyses.map((a, i) => {
      const x = (a.risk_score / 100) * 6 - 3;
      const y = Math.sin(i * 1.7) * 2;
      const z = (i / Math.max(analyses.length, 1)) * 6 - 3;

      const lvl = a.risk_level.toLowerCase();
      let color = '#158067';
      if (lvl === 'medium') color = '#D9820B';
      if (lvl === 'high') color = '#D95D1E';
      if (lvl === 'critical') color = '#D9383A';

      return {
        position: [x, y, z] as [number, number, number],
        color,
        size: lvl === 'critical' ? 0.14 : 0.1,
        label: a.threat_type,
      };
    });
  }, [analyses]);

  return (
    <div className="h-[360px] w-full bg-surface-muted rounded-[22px] overflow-hidden border border-border-default relative">
      <div className="absolute top-3.5 left-4 z-10">
        <span className="text-[11px] font-semibold text-muted">Mobile Threat View</span>
      </div>
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={15} />
        <ambientLight intensity={1.0} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
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
      </Canvas>
    </div>
  );
}
