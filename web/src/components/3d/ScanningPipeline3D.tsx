'use client';

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';

export interface PipelineStageInfo {
  id: number;
  name: string;
  code: string;
  tag: string;
  description: string;
  metric: string;
  latency: string;
}

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    id: 0,
    name: 'Ingestion & Hygiene',
    code: 'STAGE_01 // INGEST',
    tag: 'SANITIZER',
    description: 'Deobfuscates Unicode zero-width tricks, extracts OCR text in-memory, strips tracking headers.',
    metric: '100% In-Memory',
    latency: '18ms',
  },
  {
    id: 1,
    name: 'Heuristic Tokenizer',
    code: 'STAGE_02 // HEURISTICS',
    tag: 'LEXICAL',
    description: 'Evaluates high-entropy patterns, urgent call-to-actions, impersonation tokens and bank prefixes.',
    metric: '42 Regex Rules',
    latency: '34ms',
  },
  {
    id: 2,
    name: 'Transformer Neural Net',
    code: 'STAGE_03 // NEURAL ML',
    tag: 'CLASSIFIER',
    description: 'Evaluates semantic embeddings through fine-tuned multimodal scam classification models.',
    metric: '0.992 F1 Score',
    latency: '82ms',
  },
  {
    id: 3,
    name: 'Threat Intel & IOCs',
    code: 'STAGE_04 // INTEL SENTRY',
    tag: 'IOC LOOKUP',
    description: 'Live query of phishing domains, malicious hashes, known crypto drainers, and campaign clusters.',
    metric: '4.8M Signatures',
    latency: '54ms',
  },
  {
    id: 4,
    name: 'Explainable Fusion',
    code: 'STAGE_05 // SYNTHESIZER',
    tag: 'VERDICT',
    description: 'Fused multi-engine risk synthesis generating 0–100 score, evidence list, and response guidance.',
    metric: 'Deterministic',
    latency: '22ms',
  },
];

function PipelineNode({
  position,
  stage,
  isSelected,
  onClick,
}: {
  position: [number, number, number];
  stage: PipelineStageInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.LineSegments>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (isSelected ? 1.5 : 0.6);
      meshRef.current.rotation.x += delta * 0.4;
      const targetScale = isSelected ? 1.35 : hovered ? 1.2 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.8;
    }
  });

  const nodeColor = isSelected ? '#38bdf8' : hovered ? '#60a5fa' : '#2563eb';
  const emissiveColor = isSelected ? '#0284c7' : '#1d4ed8';

  return (
    <group position={position}>
      {/* 3D Geometry Core */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {stage.id === 0 && <boxGeometry args={[0.7, 0.7, 0.7]} />}
        {stage.id === 1 && <octahedronGeometry args={[0.55, 0]} />}
        {stage.id === 2 && <dodecahedronGeometry args={[0.55, 0]} />}
        {stage.id === 3 && <icosahedronGeometry args={[0.55, 0]} />}
        {stage.id === 4 && <torusGeometry args={[0.42, 0.16, 16, 32]} />}

        <meshStandardMaterial
          color={nodeColor}
          emissive={emissiveColor}
          emissiveIntensity={isSelected ? 1.8 : hovered ? 1.2 : 0.6}
          roughness={0.2}
          metalness={0.8}
          wireframe={!isSelected}
        />
      </mesh>

      {/* Target Sensor Beacon Ring */}
      <lineSegments ref={ringRef}>
        <wireframeGeometry args={[new THREE.RingGeometry(0.85, 0.88, 32)]} />
        <lineBasicMaterial color={isSelected ? '#38bdf8' : '#3b82f6'} transparent opacity={isSelected ? 0.7 : 0.25} />
      </lineSegments>

      {/* Stage Number Plate */}
      <Text
        position={[0, -1.15, 0]}
        fontSize={0.22}
        color={isSelected ? '#38bdf8' : '#94a3b8'}
        anchorX="center"
        anchorY="middle"
      >
        {`0${stage.id + 1}`}
      </Text>
    </group>
  );
}

// Traveling data packet pulses along the curve
function DataPacketStream({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const packetRef = useRef<THREE.Mesh>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    progress.current = (progress.current + delta * 0.35) % 1;
    if (packetRef.current) {
      const pos = curve.getPointAt(progress.current);
      packetRef.current.position.copy(pos);
    }
  });

  return (
    <mesh ref={packetRef}>
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshBasicMaterial color="#38bdf8" />
    </mesh>
  );
}

// Glowing conduit spline connecting all 5 stages
function ConduitSpline({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const lineMesh = useMemo(() => {
    const points = curve.getPoints(80);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x1e3a8a, transparent: true, opacity: 0.4 });
    return new THREE.Line(geometry, material);
  }, [curve]);

  return <primitive object={lineMesh} />;
}

export default function ScanningPipeline3D() {
  const [activeStage, setActiveStage] = useState(2); // default: Deep Neural Classifier

  const nodePositions: [number, number, number][] = useMemo(
    () => [
      [-5.6, 0.4, 0],
      [-2.8, -0.3, 0.4],
      [0, 0.5, 0],
      [2.8, -0.3, -0.4],
      [5.6, 0.4, 0],
    ],
    []
  );

  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(
      nodePositions.map((p) => new THREE.Vector3(...p)),
      false,
      'catmullrom',
      0.5
    );
  }, [nodePositions]);

  const currentStage = PIPELINE_STAGES[activeStage];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#050811] via-[#070d1c] to-[#04060d] p-6 shadow-2xl backdrop-blur-2xl">
      {/* Background Cyber Grid */}
      <div className="tl-cyber-grid pointer-events-none absolute inset-0 opacity-30" />

      {/* Header HUD */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 font-mono text-[11px]">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
          </span>
          <span className="font-bold tracking-wider text-slate-200">
            3D SCANNING PIPELINE ARCHITECTURE // 5-CHAMBER FLOW
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 text-[10px]">
          <span>STREAM: 1.48 MB/s</span>
          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-emerald-400 font-bold">
            HEALTH: 99.98% OPTIMAL
          </span>
        </div>
      </div>

      {/* 3D WebGL Canvas */}
      <div className="relative h-[280px] w-full select-none cursor-pointer">
        <Canvas gl={{ antialias: true, alpha: true }}>
          <PerspectiveCamera makeDefault position={[0, 0, 7.5]} fov={50} />
          <ambientLight intensity={0.5} />
          <pointLight position={[0, 5, 5]} intensity={1.2} color="#60a5fa" />
          <pointLight position={[0, -5, -3]} intensity={0.6} color="#06b6d4" />

          <ConduitSpline curve={curve} />
          <DataPacketStream curve={curve} />

          {PIPELINE_STAGES.map((stage) => (
            <PipelineNode
              key={stage.id}
              position={nodePositions[stage.id]}
              stage={stage}
              isSelected={activeStage === stage.id}
              onClick={() => setActiveStage(stage.id)}
            />
          ))}
        </Canvas>
      </div>

      {/* Active Stage Telemetry Dossier Panel */}
      <div className="relative z-10 mt-3 rounded-2xl border border-white/10 bg-[#080e1e]/90 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-cyan">
                {currentStage.code}
              </span>
              <span className="rounded border border-brand/30 bg-brand/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-brand-hover">
                {currentStage.tag}
              </span>
            </div>
            <h4 className="mt-1 text-lg font-bold text-white tracking-tight">
              {currentStage.name}
            </h4>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">
              {currentStage.description}
            </p>
          </div>

          <div className="flex items-center gap-6 border-t border-white/5 pt-3 sm:border-t-0 sm:pt-0 font-mono">
            <div>
              <span className="block text-[10px] text-slate-400 uppercase">Latency</span>
              <span className="text-base font-bold text-white tabular-nums">
                {currentStage.latency}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 uppercase">Assurance</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">
                {currentStage.metric}
              </span>
            </div>
          </div>
        </div>

        {/* Tactical Stage Picker Tabs */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-white/5 pt-3">
          {PIPELINE_STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveStage(s.id)}
              className={`rounded-xl border p-2 text-left font-mono text-[10px] transition-all ${
                activeStage === s.id
                  ? 'border-brand-cyan bg-brand/15 text-white shadow-[var(--shadow-cyber)]'
                  : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200'
              }`}
            >
              <div className="font-bold">0{s.id + 1} // {s.tag}</div>
              <div className="truncate text-[9px] text-slate-400 mt-0.5">{s.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
