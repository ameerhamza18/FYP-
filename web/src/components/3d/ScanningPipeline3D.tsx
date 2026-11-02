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
    code: 'Stage 01 · Ingest',
    tag: 'Sanitizer',
    description:
      'Deobfuscates Unicode zero-width tricks, extracts OCR text in-memory, and strips tracking headers.',
    metric: '100% In-Memory',
    latency: '18ms',
  },
  {
    id: 1,
    name: 'Heuristic Tokenizer',
    code: 'Stage 02 · Heuristics',
    tag: 'Lexical',
    description:
      'Evaluates high-entropy patterns, urgent call-to-actions, impersonation tokens, and bank prefixes.',
    metric: '42 Regex Rules',
    latency: '34ms',
  },
  {
    id: 2,
    name: 'Transformer Neural Net',
    code: 'Stage 03 · Neural ML',
    tag: 'Classifier',
    description:
      'Evaluates semantic embeddings through fine-tuned multimodal scam classification models.',
    metric: '0.992 F1 Score',
    latency: '82ms',
  },
  {
    id: 3,
    name: 'Threat Intel & IOCs',
    code: 'Stage 04 · Intel Sentry',
    tag: 'IOC Lookup',
    description:
      'Live query of phishing domains, malicious hashes, known crypto drainers, and campaign clusters.',
    metric: '4.8M Signatures',
    latency: '54ms',
  },
  {
    id: 4,
    name: 'Explainable Fusion',
    code: 'Stage 05 · Synthesizer',
    tag: 'Verdict',
    description:
      'Fused multi-engine risk synthesis generating a 0–100 score, evidence list, and response guidance.',
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
      meshRef.current.rotation.y += delta * (isSelected ? 1.4 : 0.55);
      meshRef.current.rotation.x += delta * 0.35;
      const targetScale = isSelected ? 1.32 : hovered ? 1.18 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.7;
    }
  });

  const nodeColor = isSelected ? '#8b3dff' : hovered ? '#6d28d9' : '#5b66c9';
  const emissiveColor = isSelected ? '#8b3dff' : '#4f46e5';

  return (
    <group position={position}>
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
          emissiveIntensity={isSelected ? 0.55 : hovered ? 0.32 : 0.18}
          roughness={0.22}
          metalness={0.35}
          wireframe={!isSelected}
        />
      </mesh>

      <lineSegments ref={ringRef}>
        <wireframeGeometry args={[new THREE.RingGeometry(0.85, 0.88, 32)]} />
        <lineBasicMaterial
          color={isSelected ? '#8b3dff' : '#6366f1'}
          transparent
          opacity={isSelected ? 0.65 : 0.25}
        />
      </lineSegments>

      <Text
        position={[0, -1.15, 0]}
        fontSize={0.22}
        color={isSelected ? '#6d28d9' : '#6e6c65'}
        anchorX="center"
        anchorY="middle"
      >
        {`0${stage.id + 1}`}
      </Text>
    </group>
  );
}

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
      <sphereGeometry args={[0.09, 12, 12]} />
      <meshBasicMaterial color="#158067" />
    </mesh>
  );
}

function ConduitSpline({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const lineMesh = useMemo(() => {
    const points = curve.getPoints(80);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x8b3dff,
      transparent: true,
      opacity: 0.32,
    });
    return new THREE.Line(geometry, material);
  }, [curve]);

  return <primitive object={lineMesh} />;
}

export default function ScanningPipeline3D() {
  const [activeStage, setActiveStage] = useState(2);

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
    <div className="relative overflow-hidden rounded-[28px] border border-border-default bg-surface p-6 shadow-[var(--shadow-card)]">
      {/* Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-4 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B3DFF] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8B3DFF]" />
          </span>
          <span className="font-bold text-foreground">
            3D Scanning Pipeline · 5-Stage Validation Flow
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="hidden sm:inline">Stream 1.48 MB/s</span>
          <span className="rounded-full bg-[#DFF4EC] px-3 py-1 text-[11px] font-semibold text-[#158067]">
            • 99.98% Optimal
          </span>
        </div>
      </div>

      {/* Soft Studio 3D Canvas */}
      <div className="relative mt-4 h-[270px] w-full select-none cursor-pointer overflow-hidden rounded-[22px] border border-border-default/70 bg-gradient-to-b from-[#FAF9F5] via-[#EEF1FE]/65 to-[#F6EFE8] dark:from-[#18181F] dark:via-[#1E1D2B] dark:to-[#15151B]">
        <div className="tl-cyber-dots pointer-events-none absolute inset-0 opacity-40" />
        <Canvas gl={{ antialias: true, alpha: true }}>
          <PerspectiveCamera makeDefault position={[0, 0, 7.5]} fov={50} />
          <ambientLight intensity={1.1} />
          <pointLight position={[0, 5, 5]} intensity={1.3} color="#ffffff" />
          <pointLight position={[0, -5, -3]} intensity={0.7} color="#8b3dff" />

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

      {/* Active Stage Dossier */}
      <div className="relative z-10 mt-4 rounded-[22px] border border-border-default bg-surface-muted/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#6D28D9] dark:text-[#C4B5FD]">
                {currentStage.code}
              </span>
              <span className="rounded-full bg-[#E8EDFE] px-2.5 py-0.5 text-[10px] font-semibold text-[#28326B]">
                {currentStage.tag}
              </span>
            </div>
            <h4 className="tl-serif mt-1.5 text-2xl font-normal tracking-tight text-foreground">
              {currentStage.name}
            </h4>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              {currentStage.description}
            </p>
          </div>

          <div className="flex items-center gap-6 border-t border-border-default pt-3 sm:border-t-0 sm:pt-0">
            <div>
              <span className="block text-[11px] font-medium text-muted">Latency</span>
              <span className="tl-serif text-2xl text-foreground tabular-nums">
                {currentStage.latency}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-muted">Assurance</span>
              <span className="text-sm font-bold text-[#158067] tabular-nums">
                {currentStage.metric}
              </span>
            </div>
          </div>
        </div>

        {/* Stage Picker Pills */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-default pt-4 sm:grid-cols-5">
          {PIPELINE_STAGES.map((s) => {
            const active = activeStage === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStage(s.id)}
                className={`rounded-2xl border px-3 py-2.5 text-left text-xs transition-all ${
                  active
                    ? 'border-brand bg-brand text-brand-foreground shadow-sm'
                    : 'border-border-default bg-surface text-muted hover:bg-surface-hover hover:text-foreground'
                }`}
              >
                <div className="text-[10px] font-semibold opacity-80">
                  0{s.id + 1} · {s.tag}
                </div>
                <div className="mt-0.5 truncate font-semibold">{s.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
