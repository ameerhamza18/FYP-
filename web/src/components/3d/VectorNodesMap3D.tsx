'use client';

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

export interface VectorNode {
  id: string;
  name: string;
  ip: string;
  type: 'malware' | 'suspicious' | 'c2';
  position: [number, number, number];
  hits: number;
}

export interface VectorEdge {
  from: string;
  to: string;
  type: 'malware' | 'suspicious' | 'c2';
}

const DEFAULT_NODES: VectorNode[] = [
  { id: 'n1', name: 'MALWARE_CORE_01', ip: '19.135.1.163', type: 'malware', position: [0, 0.4, 0], hits: 84 },
  { id: 'n2', name: 'SUSP_PAYLOAD_A', ip: '19.128.1.193', type: 'suspicious', position: [-2.4, 0.2, 1.2], hits: 45 },
  { id: 'n3', name: 'C2_BEACON_ALPHA', ip: '84.17.20.211', type: 'c2', position: [2.2, 0.3, -1.1], hits: 62 },
  { id: 'n4', name: 'MALWARE_DROPPER', ip: '19.130.1.183', type: 'malware', position: [-1.5, 0.25, -2.0], hits: 78 },
  { id: 'n5', name: 'SUSP_DNS_HOP', ip: '04.17.20.211', type: 'suspicious', position: [1.6, 0.2, 1.8], hits: 39 },
  { id: 'n6', name: 'C2_PROXY_GATE', ip: '84.17.28.211', type: 'c2', position: [3.2, 0.2, 0.6], hits: 91 },
  { id: 'n7', name: 'EXPLOIT_VECTOR', ip: '10.128.1.152', type: 'malware', position: [-3.1, 0.2, -0.8], hits: 71 },
];

const DEFAULT_EDGES: VectorEdge[] = [
  { from: 'n1', to: 'n2', type: 'suspicious' },
  { from: 'n1', to: 'n3', type: 'c2' },
  { from: 'n1', to: 'n4', type: 'malware' },
  { from: 'n3', to: 'n5', type: 'suspicious' },
  { from: 'n3', to: 'n6', type: 'c2' },
  { from: 'n2', to: 'n7', type: 'malware' },
  { from: 'n5', to: 'n1', type: 'suspicious' },
];

function NodeMesh({
  node,
  isSelected,
  onSelect,
}: {
  node: VectorNode;
  isSelected: boolean;
  onSelect: (node: VectorNode) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => {
    switch (node.type) {
      case 'malware': return '#ef4444'; // Red
      case 'suspicious': return '#38bdf8'; // Cyan
      case 'c2': return '#f59e0b'; // Amber
    }
  }, [node.type]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (node.type === 'malware' ? 0.8 : 0.4);
    }
    if (beaconRef.current) {
      const scale = 1.0 + Math.sin(Date.now() * 0.005 + Number(node.id.slice(1))) * 0.25;
      beaconRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={node.position}>
      {/* Base Pedestal (Isometric chip look matching web.jpg) */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.55, 0.1, 0.55]} />
        <meshStandardMaterial color="#0c1527" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* Glowing Border Trim */}
      <mesh position={[0, -0.09, 0]}>
        <boxGeometry args={[0.57, 0.02, 0.57]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      {/* Floating 3D Core Node */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        {node.type === 'malware' ? (
          <octahedronGeometry args={[0.22, 0]} />
        ) : node.type === 'c2' ? (
          <boxGeometry args={[0.25, 0.25, 0.25]} />
        ) : (
          <tetrahedronGeometry args={[0.22, 0]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 2.8 : 1.2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Pulse Beacon Aura */}
      <mesh ref={beaconRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.35 : 0.12} wireframe />
      </mesh>

      {/* Floating HUD Tag */}
      {(hovered || isSelected) && (
        <Html position={[0, 0.55, 0]} center distanceFactor={8} zIndexRange={[100, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded border border-white/20 bg-slate-950/90 px-2 py-1 font-mono text-[10px] text-white shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 font-bold" style={{ color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {node.name}
            </div>
            <div className="text-[9px] text-slate-400">IP: {node.ip}</div>
            <div className="text-[9px] text-slate-400">Threat Index: {node.hits}%</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function VectorLines({
  nodes,
  edges,
}: {
  nodes: VectorNode[];
  edges: VectorEdge[];
}) {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const linesData = useMemo(() => {
    return edges.map(edge => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) return null;

      const points = [
        new THREE.Vector3(...fromNode.position),
        new THREE.Vector3(...toNode.position),
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));

      let color = '#38bdf8';
      if (edge.type === 'malware') color = '#ef4444';
      if (edge.type === 'c2') color = '#f59e0b';

      return { geometry, color, from: fromNode, to: toNode };
    }).filter(Boolean);
  }, [edges, nodeMap]);

  return (
    <group>
      {linesData.map((line, idx) => line && (
        <line key={idx} geometry={line.geometry}>
          <lineBasicMaterial color={line.color} transparent opacity={0.55} linewidth={1.5} />
        </line>
      ))}
    </group>
  );
}

function CyberGridFloor() {
  return (
    <group position={[0, -0.2, 0]}>
      {/* Isometric Grid Helper */}
      <gridHelper args={[14, 28, '#0284c7', '#0e244d']} />
      {/* Translucent Floor Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial color="#030712" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

export default function VectorNodesMap3D({
  selectedNode,
  onSelectNode,
  className = '',
}: {
  selectedNode?: VectorNode | null;
  onSelectNode?: (node: VectorNode) => void;
  className?: string;
}) {
  const [activeNode, setActiveNode] = useState<VectorNode | null>(selectedNode || DEFAULT_NODES[0]);

  const handleSelect = (n: VectorNode) => {
    setActiveNode(n);
    onSelectNode?.(n);
  };

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-xl border border-sky-900/40 bg-[#030712] ${className}`}>
      {/* Top HUD Overlay matching web.jpg */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
        <span className="flex h-5 items-center gap-1.5 rounded border border-sky-500/30 bg-sky-950/60 px-2 font-mono text-[10px] font-bold text-sky-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
          VECTOR NODES MAP
        </span>
        <span className="font-mono text-[9px] text-slate-500">[CORRELATION ACTIVE: 7 NODES]</span>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2 text-slate-500">
        <span className="font-mono text-[10px] text-sky-400/80">3D ISOMETRIC TOPOLOGY</span>
      </div>

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[5.5, 4.8, 5.5]} fov={38} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 10, 4]} intensity={1.2} />
        <pointLight position={[0, 3, 0]} intensity={1.5} color="#38bdf8" distance={8} />

        <CyberGridFloor />
        <VectorLines nodes={DEFAULT_NODES} edges={DEFAULT_EDGES} />
        {DEFAULT_NODES.map((n) => (
          <NodeMesh
            key={n.id}
            node={n}
            isSelected={activeNode?.id === n.id}
            onSelect={handleSelect}
          />
        ))}

        <OrbitControls
          enableZoom={true}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 6}
          minDistance={4}
          maxDistance={12}
        />
      </Canvas>

      {/* Floating Sub-Panel overlay on bottom right (Vector Nodes Map Mini inset preview) */}
      <div className="pointer-events-auto absolute bottom-3 right-3 z-10 w-44 rounded-lg border border-sky-900/60 bg-slate-950/85 p-2.5 backdrop-blur-md shadow-2xl">
        <div className="flex items-center justify-between text-[9px] font-mono font-bold text-sky-400 mb-1.5">
          <span>TARGET TOPOLOGY</span>
          <span className="text-slate-500">x,y,z</span>
        </div>
        <div className="space-y-1 font-mono text-[9px] text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-500">Selected:</span>
            <span className="text-white font-semibold">{activeNode?.name || 'MALWARE_CORE'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">IP Host:</span>
            <span className="text-sky-300">{activeNode?.ip || '19.135.1.163'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Correlation:</span>
            <span className="text-rose-400 font-bold">{activeNode?.hits || 84}% Critical</span>
          </div>
        </div>
      </div>
    </div>
  );
}
