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
      case 'malware':
        return '#D9383A';
      case 'suspicious':
        return '#8B3DFF';
      case 'c2':
        return '#D9820B';
    }
  }, [node.type]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (node.type === 'malware' ? 0.8 : 0.45);
    }
    if (beaconRef.current) {
      const scale = 1.0 + Math.sin(Date.now() * 0.004 + Number(node.id.slice(1) || 1)) * 0.2;
      beaconRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={node.position}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.55, 0.08, 0.55]} />
        <meshStandardMaterial color="#E6E2D8" roughness={0.5} metalness={0.15} />
      </mesh>

      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.57, 0.02, 0.57]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>

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
          <octahedronGeometry args={[0.24, 0]} />
        ) : node.type === 'c2' ? (
          <boxGeometry args={[0.26, 0.26, 0.26]} />
        ) : (
          <tetrahedronGeometry args={[0.24, 0]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.8 : 0.3}
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>

      <mesh ref={beaconRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.25 : 0.09} wireframe />
      </mesh>

      {(hovered || isSelected) && (
        <Html position={[0, 0.58, 0]} center distanceFactor={8} zIndexRange={[100, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-2xl border border-border-default bg-surface/95 px-3 py-1.5 text-[11px] text-foreground shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5 font-bold" style={{ color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {node.name}
            </div>
            <div className="text-[10px] text-muted">{node.ip} · {node.hits}% risk</div>
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
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const lineObjects = useMemo(() => {
    return edges
      .map((edge) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return null;

        const points = [
          new THREE.Vector3(...fromNode.position),
          new THREE.Vector3(...toNode.position),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));

        let color = '#8B3DFF';
        if (edge.type === 'malware') color = '#D9383A';
        if (edge.type === 'c2') color = '#D9820B';

        const material = new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.45,
        });

        return new THREE.Line(geometry, material);
      })
      .filter(Boolean) as THREE.Line[];
  }, [edges, nodeMap]);

  return (
    <group>
      {lineObjects.map((lineObj, idx) => (
        <primitive key={idx} object={lineObj} />
      ))}
    </group>
  );
}

function StudioGridFloor() {
  return (
    <group position={[0, -0.2, 0]}>
      <gridHelper args={[14, 24, '#D6D1C7', '#E6E2D8']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial color="#F5F3EE" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

export default function VectorNodesMap3D({
  nodes,
  edges,
  selectedNode,
  onSelectNode,
  className = '',
}: {
  nodes?: VectorNode[];
  edges?: VectorEdge[];
  selectedNode?: VectorNode | null;
  onSelectNode?: (node: VectorNode) => void;
  className?: string;
}) {
  const resolvedNodes = nodes && nodes.length > 0 ? nodes : DEFAULT_NODES;
  const resolvedEdges = useMemo(() => {
    if (edges && edges.length > 0) return edges;
    if (nodes && nodes.length > 0) {
      return nodes.slice(1).map((n) => ({
        from: nodes[0].id,
        to: n.id,
        type: n.type,
      }));
    }
    return DEFAULT_EDGES;
  }, [edges, nodes]);

  const [activeNode, setActiveNode] = useState<VectorNode | null>(selectedNode || resolvedNodes[0]);

  const handleSelect = (n: VectorNode) => {
    setActiveNode(n);
    onSelectNode?.(n);
  };

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[22px] border border-border-default bg-gradient-to-b from-[#FAF8F4] via-[#F4F1EA] to-[#ECE8DF] dark:from-[#1B1B20] dark:to-[#141418] ${className}`}
    >
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface/90 px-3 py-1 text-[11px] font-semibold text-foreground shadow-2xs backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-[#8B3DFF] tl-beacon" />
          Correlation Topology · {resolvedNodes.length} Nodes
        </span>
      </div>

      <Canvas gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[5.5, 4.8, 5.5]} fov={38} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[6, 10, 4]} intensity={1.3} />
        <pointLight position={[0, 3, 0]} intensity={0.9} color="#8B3DFF" distance={10} />

        <StudioGridFloor />
        <VectorLines nodes={resolvedNodes} edges={resolvedEdges} />
        {resolvedNodes.map((n) => (
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

      <div className="pointer-events-auto absolute bottom-3.5 right-3.5 z-10 w-52 rounded-2xl border border-border-default bg-surface/92 p-3 backdrop-blur-md shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
          <span>Selected Node</span>
          <span className="text-[#8B3DFF]">Live</span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-muted">Cluster:</span>
            <span className="truncate font-semibold text-foreground">{activeNode?.name || 'CORE'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted">Ref:</span>
            <span className="truncate text-foreground">{activeNode?.ip || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted">Index:</span>
            <span className="font-bold text-[#7C3AED]">{activeNode?.hits || 0}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
