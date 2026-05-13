import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei'; // Required for the soft floor shadow
import * as THREE from 'three';
import { FriendState } from './types';

const CubeSphere = ({ state, severity = 'normal' }: { state: FriendState, severity?: string }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 6000; // Massively increased density for the "Solid Voxel" look
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Retraction Lock: 0.03 Alpha for that perfect honey-like return
  const momentum = useRef({ x: 0, y: 0, lastE: 0 });

  // --- THE ODRZYWOŁEK KERNEL ---
  const eml = (x: number, y: number) => {
    return Math.exp(x) - Math.log(Math.abs(y) + 0.000001);
  };

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        phi: Math.acos(-1 + (2 * i) / count),
        theta: Math.sqrt(count * Math.PI) * Math.acos(-1 + (2 * i) / count),
        chaos: Math.random() * 12.0, 
        id: i
      });
    }
    return temp;
  }, [count]);

  useFrame((stateContext) => {
    const { clock, camera } = stateContext;
    const time = clock.getElapsedTime();
    if (!meshRef.current) return;

    // 1. HARVEST NATIVE EML INPUTS
    const rootStyle = getComputedStyle(document.documentElement);
    const rawPitch = parseFloat(rootStyle.getPropertyValue('--pitch')) || 0;
    const rawRoll = parseFloat(rootStyle.getPropertyValue('--roll')) || 0;

    // 2. MOMENTUM & RETRACTION (Locked at 0.03)
    momentum.current.x = THREE.MathUtils.lerp(momentum.current.x, rawRoll * 9.5, 0.03);
    momentum.current.y = THREE.MathUtils.lerp(momentum.current.y, -rawPitch * 9.5, 0.03);

    const { x: mX, y: mY } = momentum.current;
    const M = Math.sqrt(mX * mX + mY * mY);

    // 3. THE SINGULARITY CORE (Lambda)
    // Idle: 1.4 (Tight nucleus) | Active: 2.2 (Expanded field)
    const Lambda = state === 'idle' ? .9 : 2.2;

    particles.forEach((p, i) => {
      // 4. THE VIOLENT SPILL (EML JERK PHYSICS)
      const signal = eml(Math.sin(p.phi * 6 + time), Lambda);
      
      const uX = Math.cos(p.theta) * Math.sin(p.phi);
      const uY = Math.sin(p.theta) * Math.sin(p.phi);
      const uZ = Math.cos(p.phi);

      const dot = (uX * mX + uY * mY) / (M + 0.01);
      
      // SPILL OPERATOR: Detonates the nucleus based on velocity
      const leadingEdge = Math.max(0, dot);
      const spillForce = Math.pow(leadingEdge * M, 2.7) * 0.9;
      
      // VERTEX SHARPENING (EML-NAND)
      const spike = eml(signal, 8) * 0.0025 * (M + 1);

      // Final Radius calculation
      const dynamicR = Lambda + spike + spillForce;

      let x = uX * dynamicR;
      let y = uY * dynamicR;
      let z = uZ * dynamicR;

      // 5. WEIGHTED SLOSH
      x += (mX * 0.5);
      y += (mY * 0.5);

      // 6. NANOGRAVITY VORTICITY
      if (M > 1.8) {
        const swirl = Math.sin(time * 6 + p.chaos) * (M * 0.055);
        x += swirl;
        z += swirl;
      }

      // 7. PIXELATED JITTER
      if (state === 'speaking') {
        const j = eml(Math.sin(time * 70 + i), 14) * 0.013;
        x += j; y += j; z += j;
      }

      dummy.position.set(x, y, z);
      
      // 8. DYNAMIC SCALE (SINGULARITY COMPRESSION)
      // Scaled down massively for high-density count.
      const distFromCenter = Math.sqrt(x*x + y*y + z*z);
      let s = 0.055; // Default chunk size
      
      if (state === 'idle') {
        s = 0.06; // Highly overlapping for solid perfect ball
      } else if (distFromCenter > 4.5) {
        s = 0.035; // Razor-sharp filament tips
      } else {
        s = 0.07; // Inflated data chunks during spill
      }
      
      dummy.scale.set(s, s, s);
      dummy.rotation.set(time * 0.1, time * 0.2 + p.chaos, 0);
      
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    // 9. CAMERA PARALLAX
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, rawRoll * 5, 0.1);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, rawPitch * 5, 0.1);
    camera.lookAt(0, 0, 0);

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Color Mapping: Royal Blue default, supporting critical/important states
  const getOrbColor = () => {
    if (severity === 'critical') return '#ef4444'; // Red
    if (severity === 'important') return '#f59e0b'; // Amber
    return '#2563EB'; // Royal Blue
  };

  const orbColor = getOrbColor();

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial 
        color={orbColor} 
        emissive={orbColor} 
        // Emissive intensity lowered to prevent "blowing out" against the white background
        emissiveIntensity={state === 'speaking' ? 0.8 : 0.2} 
        roughness={0.4}
        metalness={0.1}
        toneMapped={true} 
      />
    </instancedMesh>
  );
};

const SovereignVisualizer = ({ state, severity }: { state: FriendState, severity?: string }) => (
  // Tailwind handles light/dark mode natively here: bg-white for light, dark:bg-black for dark mode
  <div className="w-full h-full absolute inset-0 bg-white dark:bg-black overflow-hidden pointer-events-none transition-colors duration-500">
    <Canvas camera={{ position: [0, 0, 10], fov: 38 }} dpr={[1, 2]}>
      {/* Lighting adjusted to support a bright background */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      <CubeSphere state={state} severity={severity} />
      
      {/* SOFT DROP SHADOW: perfectly anchors the sphere to the "floor" */}
      <ContactShadows 
        position={[0, -2.8, 0]} 
        opacity={0.4} 
        scale={10} 
        blur={2.5} 
        far={4} 
        color="#000000" 
      />
    </Canvas>
  </div>
);

export default SovereignVisualizer;