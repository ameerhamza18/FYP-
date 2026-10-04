'use client';

import React, { useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Sphere, PerspectiveCamera, Html } from '@react-three/drei';
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
      const targetScale = hovered ? 1.8 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
      meshRef.current.rotation.y += delta * 0.8;
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
          emissiveIntensity={hovered ? 2.5 : 1.0}
          roughness={0.1}
          metalness={0.9}
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
        // Correlate threats with similar risk profiles or same threat type
        if (points[i].label === points[j].label && Math.abs(points[i].score - points[j].score) < 15) {
          pairs.push(new THREE.Vector3(...points[i].position));
          pairs.push(new THREE.Vector3(...points[j].position));
        }
      }
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pairs.slice(0, 32));
    const material = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
    return new THREE.LineSegments(geometry, material);
  }, [points]);

  return <primitive object={lineMesh} />;
}

// Concentric Orbital Reference Radar Grid
function RadarGridSpheres() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.8, 6.84, 64]} />
        <meshBasicMaterial color="#1e293b" side={THREE.DoubleSide} transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[11.8, 11.84, 64]} />
        <meshBasicMaterial color="#1e293b" side={THREE.DoubleSide} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

export default function ThreatCloud({ analyses }: { analyses: (Analysis | AdminAnalysis)[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<ThreatPointData | null>(null);

  const points: ThreatPointData[] = useMemo(() => {
    if (!analyses || analyses.length === 0) {
      // Deterministic demo points if empty
      return [
        { id: 1, position: [-3, 2, 1], color: '#ef4444', size: 0.22, label: 'Credential Harvest', score: 92, level: 'CRITICAL', source: 'sms' },
        { id: 2, position: [2, -2, -1], color: '#f97316', size: 0.18, label: 'Bank Impersonation', score: 76, level: 'HIGH', source: 'web' },
        { id: 3, position: [-1, -3, 2], color: '#eab308', size: 0.16, label: 'Urgent Lottery', score: 55, level: 'MEDIUM', source: 'whatsapp' },
        { id: 4, position: [4, 1, 2], color: '#10b981', size: 0.14, label: 'Legitimate Notice', score: 18, level: 'LOW', source: 'email' },
      ];
    }

    return analyses.slice(0, 48).map((a, i) => {
      // Coordinate mapped to risk score, index, and angle
      const angle = (i / Math.min(analyses.length, 48)) * Math.PI * 2;
      const radius = 2.5 + ((100 - a.risk_score) / 100) * 5.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = ((a.risk_score / 100) * 5 - 2.5) + (Math.sin(i * 1.5) * 0.8);

      let color = '#10b981';
      if (a.risk_level === 'medium') color = '#eab308';
      if (a.risk_level === 'high') color = '#f97316';
      if (a.risk_level === 'critical') color = '#ef4444';

      return {
        id: a.id,
        position: [x, y, z] as [number, number, number],
        color,
        size: a.risk_level === 'critical' ? 0.24 : a.risk_level === 'high' ? 0.2 : 0.15,
        label: a.threat_type,
        score: a.risk_score,
        level: a.risk_level.toUpperCase(),
        source: a.input_type,
      };
    });
  }, [analyses]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#050811] via-[#070d1a] to-[#04060d]">
      <div className="tl-cyber-grid pointer-events-none absolute inset-0 opacity-25" />

      {/* Tactical HUD Header Bar */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 font-mono text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 tl-beacon" />
          <span className="font-bold text-slate-200">3D GLOBAL THREAT TOPOLOGY</span>
        </div>
        <div className="text-[9px] text-slate-500 mt-0.5">
          {points.length} CORRELATED SIGNATURE NODES
        </div>
      </div>

      {/* Hovered Node Tooltip HUD */}
      {hoveredPoint && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-xl border border-white/15 bg-[#0a1124]/95 p-3 backdrop-blur-xl shadow-2xl font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hoveredPoint.color }} />
            <span className="font-bold text-white">{hoveredPoint.label}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
            <span>RISK: <strong className="text-white tabular-nums">{hoveredPoint.score}/100</strong></span>
            <span>[{hoveredPoint.level}]</span>
            <span>SRC: {hoveredPoint.source.toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Orbit Interaction Controls Hint */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 font-mono text-[9px] text-slate-500">
        ORBIT: DRAG · ZOOM: SCROLL
      </div>

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 4, 15]} fov={45} />
        <OrbitControls enablePan={false} minDistance={6} maxDistance={22} dampingFactor={0.05} />

        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
        <pointLight position={[-10, -10, -10]} color="#38bdf8" intensity={0.8} />

        <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.3}>
          <group>
            {points.map((p) => (
              <ThreatPoint key={p.id} data={p} onHover={setHoveredPoint} />
            ))}
            <CampaignConnections points={points} />
            <RadarGridSpheres />
          </group>
        </Float>
      </Canvas>
    </div>
  );
}

