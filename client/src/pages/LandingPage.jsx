import React, { Suspense, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, MeshReflectorMaterial, Stage } from '@react-three/drei';
import '../styles/LandingPage.css';

// The Model component is correct and unchanged.
function Model() {
    const modelRef = useRef();
    const { scene } = useGLTF('/Models/Tooth.glb'); 
    
    useEffect(() => {
        scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [scene]);

    useFrame(() => {
        if (modelRef.current) {
            modelRef.current.rotation.y += 0.004;
        }
    });

    return <primitive ref={modelRef} object={scene} />;
}


// --- THIS IS THE FIX: The Scene is adjusted for a 10% size increase. ---
function Scene() {
    return (
        <Suspense fallback={null}>
            <group position={[0, -0.1, 0]} rotation={[-0.05, 0, 0]}>
                <Stage environment={"city"} intensity={0.6} contactShadow={{ opacity: 0.5, blur: 2 }} preset="rembrandt">
                    {/* 
                      The scale of this invisible box is reduced by 10% (from 4 to 3.6).
                      This makes the Stage's camera zoom IN slightly, making the tooth
                      appear 10% larger.
                    */}
                    <mesh visible={false} scale={[2.8, 2.8, 2.8]}>
                        <boxGeometry />
                    </mesh>

                    <group position={[0, -0.9, 0]}>
                        <Model />
                    </group>
                </Stage>
                
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}>
                    <planeGeometry args={[170, 170]} />
                    <MeshReflectorMaterial
                        blur={[256, 100]}
                        resolution={2048}
                        mixBlur={1}
                        mixStrength={50}
                        roughness={1}
                        depthScale={1.2}
                        minDepthThreshold={0.4}
                        maxDepthThreshold={1.4}
                        color="#101010"
                        metalness={0.8}
                    />
                </mesh>
            </group>
        </Suspense>
    );
}
// --- END OF FIX ---


// --- MAIN LANDING PAGE COMPONENT ---
const LandingPage = () => {
  return (
    <div className="landing-page-body">
      <Canvas 
        className="three-canvas" 
        shadows 
        camera={{ fov: 45 }}
        gl={{ alpha: true }}
      >
        <Scene />
      </Canvas>
      <div className="ui-container">
        <nav>
          <div className="logo"><h1>Dental Edge</h1></div>
          <div className="navbar">
            <ul className="nav-menu">
              <li className="nav-item"><a href="#" className="nav-link">About</a></li>
              <li className="nav-item"><a href="#" className="nav-link"><Link to="/contact">Contact</Link></a></li>
              <li className="nav-item"><a href="#" className="nav-link"><Link to="/plans">View Plans</Link></a></li>
              <li className="nav-item nav-top"><Link to="/login" className="nav-button">Log In</Link></li>
            </ul>
          </div>
        </nav>
        <section className="container-one">
          <div className="landing-page">
            <div className="phase-two upword">
              <h1 className="bold-76 headline">Secure Your <br /> Dental Future.</h1>
              <ul className="landing-button">
                <li><a href="#" className="landing-link">Get Started</a></li>
              </ul>
            </div>
            <div className="decp Regular-18 upword">
              <p className="para">
                In a world driven by relentless technological evolution, our commitment to innovation is the heartbeat of progress. At the intersection of imagination and engineering, we sculpt tomorrow's possibilities today.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;