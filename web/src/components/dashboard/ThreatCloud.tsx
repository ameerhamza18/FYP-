'use client';

import React, { useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Analysis, AdminAnalysis } from '@/lib/types';

interface ThreatPointData {
  id: number;
  position: [number, number, number];
  color: string;
  size: number;
  label: string;
  score: number;
  level: string;
  source: string;
}

function ThreatPoint({
  data,
  onHover,
}: {
  data: ThreatPointData;
  onHover: (item: ThreatPointData | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const targetScale = hovered ? 1.7 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
      meshRef.current.rotation.y += delta * 0.7;
    }
  });

  return (
    <group position={data.position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(data);
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
        }}
      >
        <octahedronGeometry args={[data.size, 0]} />
        <meshStandardMaterial
          color={data.color}
          emissive={data.color}
          emissiveIntensity={hovered ? 0.9 : 0.3}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>
    </group>
  );
}

function CampaignConnections({ points }: { points: ThreatPointData[] }) {
  const lineMesh = useMemo(() => {
    const pairs: THREE.Vector3[] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].label === points[j].label && Math.abs(points[i].score - points[j].score) < 15) {
          pairs.push(new THREE.Vector3(...points[i].position));
          pairs.push(new THREE.Vector3(...points[j].position));
        }
      }
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pairs.slice(0, 32));
    const material = new THREE.LineBasicMaterial({ color: 0x8b3dff, transparent: true, opacity: 0.28 });
    return new THREE.LineSegments(geometry, material);
  }, [points]);

  return <primitive object={lineMesh} />;
}

export default function ThreatCloud({ analyses }: { analyses: (Analysis | AdminAnalysis)[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<ThreatPointData | null>(null);

  const points: ThreatPointData[] = useMemo(() => {
    if (!analyses || analyses.length === 0) {
      return [
        { id: 1, position: [-3, 2, 1], color: '#D9383A', size: 0.24, label: 'Credential Harvest', score: 92, level: 'CRITICAL', source: 'sms' },
        { id: 2, position: [2, -2, -1], color: '#D95D1E', size: 0.2, label: 'Bank Impersonation', score: 76, level: 'HIGH', source: 'web' },
        { id: 3, position: [-1, -3, 2], color: '#D9820B', size: 0.18, label: 'Urgent Lottery', score: 55, level: 'MEDIUM', source: 'whatsapp' },
        { id: 4, position: [4, 1, 2], color: '#158067', size: 0.16, label: 'Legitimate Notice', score: 18, level: 'LOW', source: 'email' },
      ];
    }

    return analyses.slice(0, 48).map((a, i) => {
      const angle = (i / Math.min(analyses.length, 48)) * Math.PI * 2;
      const radius = 2.5 + ((100 - a.risk_score) / 100) * 5.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (a.risk_score / 100) * 5 - 2.5 + Math.sin(i * 1.5) * 0.8;

      const lvl = a.risk_level.toLowerCase();
      let color = '#158067';
      if (lvl === 'medium') color = '#D9820B';
      if (lvl === 'high') color = '#D95D1E';
      if (lvl === 'critical') color = '#D9383A';

      return {
        id: a.id,
        position: [x, y, z] as [number, number, number],
        color,
        size: lvl === 'critical' ? 0.24 : lvl === 'high' ? 0.2 : 0.15,
        label: a.threat_type,
        score: a.risk_score,
        level: a.risk_level.toUpperCase(),
        source: a.input_type,
      };
    });
  }, [analyses]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden rounded-[22px] border border-border-default bg-surface-muted/80">
      <div className="pointer-events-none absolute left-4 top-4 z-10 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#8B3DFF] tl-beacon" />
          <span className="font-semibold text-foreground">Global Threat Topology</span>
        </div>
        <div className="text-[11px] text-muted mt-0.5">
          {points.length} correlated signature nodes
        </div>
      </div>

      {hoveredPoint && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-2xl border border-border-default bg-surface/95 p-3 shadow-lg text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hoveredPoint.color }} />
            <span className="font-bold text-foreground">{hoveredPoint.label}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
            <span>Score: <strong className="text-foreground tabular-nums">{hoveredPoint.score}/100</strong></span>
            <span>{hoveredPoint.level}</span>
            <span>{hoveredPoint.source.toUpperCase()}</span>
          </div>
        </div>
      )}

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 4, 15]} fov={45} />
        <OrbitControls enablePan={false} minDistance={6} maxDistance={22} dampingFactor={0.05} />
        <ambientLight intensity={1.1} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
        <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.3}>
          <group>
            {points.map((p) => (
              <ThreatPoint key={p.id} data={p} onHover={setHoveredPoint} />
            ))}
            <CampaignConnections points={points} />
          </group>
        </Float>
      </Canvas>
    </div>
  );
}
