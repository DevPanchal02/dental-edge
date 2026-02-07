import React, { Suspense, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, MeshReflectorMaterial } from '@react-three/drei';
import { Box3, Vector3, Group, SpotLight, Object3D, Mesh } from 'three';
import { GLTF } from 'three-stdlib';

// Type definition for the GLTF result
type GLTFResult = GLTF & {
  nodes: Record<string, Object3D>;
  materials: Record<string, any>;
};

// We allow any props to be spread to the primitive, as R3F handles this dynamically.
interface ModelProps {
    [key: string]: any;
}

// This component now handles its own rotation
function Model(props: ModelProps) {
    // We type the ref as a THREE.Group because the GLTF scene is a Group
    const modelRef = useRef<Group>(null);
    const { scene } = useGLTF('/Models/Tooth.glb') as GLTFResult; 
    
    useEffect(() => {
        const targetSize = 2.5;
        const boundingBox = new Box3().setFromObject(scene);
        const size = new Vector3();
        boundingBox.getSize(size);
        const maxDimension = Math.max(size.x, size.y, size.z);
        const scaleFactor = targetSize / maxDimension;
        scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        const center = new Vector3();
        boundingBox.getCenter(center);
        scene.position.sub(center.multiplyScalar(scaleFactor));

        scene.traverse((child) => {
            if ((child as Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [scene]);

    // This hook runs on every frame and rotates the model
    useFrame(() => {
        if (modelRef.current) {
            modelRef.current.rotation.y += 0.003; // Controls the speed of the globe-like spin
        }
    });

    return <primitive ref={modelRef} object={scene} {...props} />;
}

// This new component creates the flashing, diffused green lights
function DynamicLights() {
    // Explicitly type the SpotLight refs
    const light1Ref = useRef<SpotLight>(null);
    const light2Ref = useRef<SpotLight>(null);

    useFrame(({ clock }) => {
        const elapsedTime = clock.getElapsedTime();
        // Guard clauses to ensure refs exist before accessing properties
        if (light1Ref.current && light2Ref.current) {
            // Use a sine wave to create a smooth, pulsing effect for the lights
            light1Ref.current.intensity = 1 + Math.sin(elapsedTime * 0.7) * 0.5;
            light2Ref.current.intensity = 1 + Math.sin(elapsedTime * 0.7 + Math.PI) * 0.5; // Phase-shifted
        }
    });

    return (
        <>
            <spotLight
                ref={light1Ref}
                color="#578E7E"
                position={[-20, 10, -15]}
                angle={0.4}
                penumbra={1}
                distance={60}
                castShadow={false} // These lights are for color, not harsh shadows
            />
            <spotLight
                ref={light2Ref}
                color="#578E7E"
                position={[20, 10, 15]}
                angle={0.4}
                penumbra={1}
                distance={60}
                castShadow={false}
            />
        </>
    );
}

// Main component that sets up the now-static scene
const ToothModel: React.FC = () => {
    return (
        <Suspense fallback={null}>
            {/* A soft ambient light to fill the scene */}
            <ambientLight intensity={0.5} />
            
            {/* The main white light source, now static */}
            <directionalLight 
              position={[8, 10, 5]} 
              intensity={2.0} 
              castShadow 
              // R3F allows passing shadow-mapSize props via specialized syntax or args, 
              // but standard props usually work for primitives. 
              // We keep the original props for exact functionality.
              shadow-mapSize-width={2048} 
              shadow-mapSize-height={2048}
              shadow-bias={-0.0001}
            />

            <Model />
            <DynamicLights />
            
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]}>
                <planeGeometry args={[50, 50]} />
                <MeshReflectorMaterial
                    blur={[400, 100]} 
                    resolution={1024}
                    mixBlur={1}
                    mixStrength={60}
                    roughness={1}
                    depthScale={1.2}
                    minDepthThreshold={0.4}
                    maxDepthThreshold={1.4}
                    color="#050505"
                    metalness={0.6}
                    mirror={0} // Required prop for MeshReflectorMaterial types in some versions
                />
            </mesh>
        </Suspense>
    );
};

export default ToothModel;