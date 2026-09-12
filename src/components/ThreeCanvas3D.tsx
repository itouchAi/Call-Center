import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AppTheme, RenderMode } from '../types';

interface ThreeCanvas3DProps {
  theme: AppTheme;
  renderMode: RenderMode;
}

// Check if WebGL context can actually be created without throwing
function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
               canvas.getContext('experimental-webgl');
    if (!gl) return false;
    // Release test context immediately
    const loseContextExt = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
    if (loseContextExt) {
      loseContextExt.loseContext();
    }
    return true;
  } catch {
    return false;
  }
}

// High-fidelity Ambient CSS Fallback when WebGL is unavailable or context is lost
const AmbientCSSBackground: React.FC<{ theme: AppTheme }> = ({ theme }) => {
  const orbConfig = {
    frosted: {
      orb1: 'bg-sky-500/20 shadow-sky-500/30',
      orb2: 'bg-indigo-500/15 shadow-indigo-500/20',
      orb3: 'bg-purple-500/15 shadow-purple-500/20',
    },
    cyberpunk: {
      orb1: 'bg-cyan-500/25 shadow-cyan-400/40',
      orb2: 'bg-fuchsia-500/20 shadow-fuchsia-500/30',
      orb3: 'bg-amber-400/15 shadow-amber-400/25',
    },
    titanium: {
      orb1: 'bg-amber-500/20 shadow-amber-500/30',
      orb2: 'bg-slate-400/15 shadow-slate-400/20',
      orb3: 'bg-emerald-500/15 shadow-emerald-500/20',
    },
    enterprise: {
      orb1: 'bg-blue-600/20 shadow-blue-500/30',
      orb2: 'bg-emerald-600/15 shadow-emerald-500/20',
      orb3: 'bg-indigo-600/15 shadow-indigo-500/20',
    },
  }[theme] || {
    orb1: 'bg-sky-500/20 shadow-sky-500/30',
    orb2: 'bg-indigo-500/15 shadow-indigo-500/20',
    orb3: 'bg-purple-500/15 shadow-purple-500/20',
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-75"
      aria-hidden="true"
    >
      <div
        className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl filter animate-pulse duration-1000 ${orbConfig.orb1}`}
      />
      <div
        className={`absolute top-1/3 -right-32 w-80 h-80 rounded-full blur-3xl filter animate-pulse duration-700 ${orbConfig.orb2}`}
      />
      <div
        className={`absolute -bottom-32 left-1/3 w-96 h-96 rounded-full blur-3xl filter animate-pulse duration-1000 ${orbConfig.orb3}`}
      />
    </div>
  );
};

export const ThreeCanvas3D: React.FC<ThreeCanvas3DProps> = ({ theme, renderMode }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGLFailed, setWebGLFailed] = useState<boolean>(false);

  useEffect(() => {
    if (renderMode === 'efficiency') return;
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // First check WebGL availability before attempting creation
    if (!checkWebGLSupport()) {
      setWebGLFailed(true);
      return;
    }

    let isDisposed = false;
    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let pMaterial: THREE.PointsMaterial | null = null;
    let meshGroup = new THREE.Group();

    try {
      // Scene & Camera
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 45;

      // Renderer with transparency & crash-safe options
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false, // Prevents context loss & excessive GPU allocation in iframes
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      });

      // Handle WebGL context loss gracefully (e.g. if browser revokes GPU context)
      const handleContextLost = (event: Event) => {
        event.preventDefault();
        console.warn('WebGL context lost. Switching to safe ambient background.');
        isDisposed = true;
        cancelAnimationFrame(animationFrameId);
        setWebGLFailed(true);
      };

      renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      currentMount.appendChild(renderer.domElement);

      // Color palette & Geometry setup based on theme
      let primaryColor = 0x38bdf8; // Sky/Azure Frost
      let secondaryColor = 0x818cf8; // Indigo/Violet
      let tertiaryColor = 0xa855f7; // Amethyst Purple
      let pCount = 200;
      let pSize = 1.8;
      let pOpacity = 0.65;

      if (theme === 'cyberpunk') {
        primaryColor = 0x00f0ff;
        secondaryColor = 0xff007f;
        tertiaryColor = 0xfacc15;
        pCount = 280;
        pSize = 2.2;
        pOpacity = 0.8;
      } else if (theme === 'titanium') {
        primaryColor = 0xf59e0b;
        secondaryColor = 0x94a3b8;
        tertiaryColor = 0x10b981;
        pCount = 180;
        pSize = 2.0;
        pOpacity = 0.7;
      } else if (theme === 'enterprise') {
        primaryColor = 0x3b82f6;
        secondaryColor = 0x10b981;
        tertiaryColor = 0x6366f1;
        pCount = 190;
        pSize = 1.7;
        pOpacity = 0.6;
      }

      // Particle Cloud (Data Nodes)
      geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(pCount * 3);
      const colors = new Float32Array(pCount * 3);

      const c1 = new THREE.Color(primaryColor);
      const c2 = new THREE.Color(secondaryColor);
      const c3 = new THREE.Color(tertiaryColor);

      for (let i = 0; i < pCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 120;
        positions[i3 + 1] = (Math.random() - 0.5) * 90;
        positions[i3 + 2] = (Math.random() - 0.5) * 70;

        const mixedColor = i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3;
        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      pMaterial = new THREE.PointsMaterial({
        size: pSize,
        vertexColors: true,
        transparent: true,
        opacity: pOpacity,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, pMaterial);
      scene.add(particles);

      // Theme Specific Core 3D Geometry
      if (theme === 'cyberpunk') {
        const knotGeo = new THREE.TorusKnotGeometry(12, 1.2, 50, 12);
        const knotMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          wireframe: true,
          transparent: true,
          opacity: 0.25,
        });
        const knot = new THREE.Mesh(knotGeo, knotMat);
        knot.position.set(28, -2, -12);
        meshGroup.add(knot);

        const octGeo = new THREE.OctahedronGeometry(14, 1);
        const octMat = new THREE.MeshBasicMaterial({
          color: 0xff007f,
          wireframe: true,
          transparent: true,
          opacity: 0.22,
        });
        const oct = new THREE.Mesh(octGeo, octMat);
        oct.position.set(-30, 8, -15);
        meshGroup.add(oct);
      } else if (theme === 'titanium') {
        const ring1Geo = new THREE.TorusGeometry(18, 0.6, 12, 40);
        const ring1Mat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          wireframe: true,
          transparent: true,
          opacity: 0.2,
        });
        const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
        ring1.position.set(24, -4, -10);
        meshGroup.add(ring1);

        const dodecGeo = new THREE.DodecahedronGeometry(12, 0);
        const dodecMat = new THREE.MeshBasicMaterial({
          color: 0x94a3b8,
          wireframe: true,
          transparent: true,
          opacity: 0.18,
        });
        const dodec = new THREE.Mesh(dodecGeo, dodecMat);
        dodec.position.set(-26, 6, -14);
        meshGroup.add(dodec);
      } else if (theme === 'enterprise') {
        const sphereGeo = new THREE.IcosahedronGeometry(16, 1);
        const sphereMat = new THREE.MeshBasicMaterial({
          color: 0x3b82f6,
          wireframe: true,
          transparent: true,
          opacity: 0.18,
        });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.set(26, -5, -12);
        meshGroup.add(sphere);

        const ringGeo = new THREE.TorusGeometry(14, 0.4, 12, 50);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          wireframe: true,
          transparent: true,
          opacity: 0.18,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(-28, 8, -15);
        meshGroup.add(ring);
      } else {
        const torusGeo = new THREE.TorusGeometry(19, 0.4, 12, 60);
        const torusMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.18,
        });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        torus.position.set(25, -5, -10);
        meshGroup.add(torus);

        const icoGeo = new THREE.IcosahedronGeometry(13, 1);
        const icoMat = new THREE.MeshBasicMaterial({
          color: 0x818cf8,
          wireframe: true,
          transparent: true,
          opacity: 0.16,
        });
        const ico = new THREE.Mesh(icoGeo, icoMat);
        ico.position.set(-28, 10, -15);
        meshGroup.add(ico);
      }

      scene.add(meshGroup);

      // Mouse interaction
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      const handleMouseMove = (event: MouseEvent) => {
        mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
        mouseY = -(event.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('mousemove', handleMouseMove, { passive: true });

      // Resize handler
      const handleResize = () => {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize, { passive: true });

      // Animation Loop with error safety
      const clock = new THREE.Clock();

      const animate = () => {
        if (isDisposed || !renderer || !scene || !camera) return;
        animationFrameId = requestAnimationFrame(animate);

        try {
          const elapsedTime = clock.getElapsedTime();

          targetX += (mouseX * 5 - targetX) * 0.05;
          targetY += (mouseY * 4 - targetY) * 0.05;
          camera.position.x = targetX;
          camera.position.y = targetY;
          camera.lookAt(0, 0, 0);

          particles.rotation.y = elapsedTime * (theme === 'cyberpunk' ? 0.05 : 0.025);
          particles.rotation.x = elapsedTime * 0.012;

          meshGroup.children.forEach((mesh, idx) => {
            mesh.rotation.x = elapsedTime * (0.1 + idx * 0.04);
            mesh.rotation.y = elapsedTime * (0.14 + idx * 0.03);
            mesh.rotation.z = elapsedTime * (0.06 + idx * 0.02);
          });

          renderer.render(scene, camera);
        } catch (renderError) {
          console.warn('Three.js render error caught:', renderError);
          cancelAnimationFrame(animationFrameId);
          setWebGLFailed(true);
        }
      };

      animate();

      return () => {
        isDisposed = true;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);

        if (renderer) {
          renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
          if (currentMount && currentMount.contains(renderer.domElement)) {
            currentMount.removeChild(renderer.domElement);
          }
          // Safely dispose geometries and materials
          try {
            geometry?.dispose();
            pMaterial?.dispose();
            meshGroup.traverse((obj) => {
              if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                if (Array.isArray(obj.material)) {
                  obj.material.forEach((m) => m.dispose());
                } else {
                  obj.material?.dispose();
                }
              }
            });
            renderer.dispose();
            // Explicitly force context loss to reclaim GPU memory and prevent leak limit
            renderer.forceContextLoss();
          } catch {
            // Context already dead, no action needed
          }
        }
      };
    } catch (initError) {
      console.warn('WebGL initialization failed safely:', initError);
      setWebGLFailed(true);
      return () => {
        isDisposed = true;
      };
    }
  }, [theme, renderMode]);

  if (renderMode === 'efficiency' || webGLFailed) {
    return <AmbientCSSBackground theme={theme} />;
  }

  return (
    <div
      ref={mountRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-90 transition-opacity duration-700"
      aria-hidden="true"
    />
  );
};

