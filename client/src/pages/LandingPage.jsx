import React, { Suspense, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, MeshReflectorMaterial, Stage } from '@react-three/drei';
import '../styles/LandingPage.css';
import { CiLocationArrow1 } from "react-icons/ci";
import { useAuth } from '../context/AuthContext';

// The Model and Scene components remain unchanged.
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

function Scene() {
    return (
        <Suspense fallback={null}>
            <group position={[0, -0.1, 0]} rotation={[-0.05, 0, 0]}>
                <Stage environment={"city"} intensity={0.6} contactShadow={{ opacity: 0.5, blur: 2 }} preset="rembrandt">
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


// --- MAIN LANDING PAGE COMPONENT ---
const LandingPage = () => {
  // Get the current user and navigation function
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Handle the click event for the "Get Started" button
  const handleGetStarted = (e) => {
    e.preventDefault(); // Prevent the default link behavior
    if (currentUser) {
      // If user is logged in, go to the app
      navigate('/app');
    } else {
      // If not logged in, go to the registration page
      navigate('/register');
    }
  };

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
              <li className="nav-item"><Link to="#" className="nav-link">About</Link></li>
              <li className="nav-item"><Link to="/contact" className="nav-link">Contact</Link></li>
              <li className="nav-item"><Link to="/plans" className="nav-link">View Plans</Link></li>
              <li className="nav-item nav-top"><Link to="/login" className="nav-button">Log In</Link></li>
            </ul>
          </div>
        </nav>
        <section className="container-one">
          <div className="landing-page">
            <div className="phase-two upword">
              <h1 className="bold-76 headline">Secure Your <br /> Dental Future.</h1>
              <ul className="landing-button">
                {/* Updated the link to use the new click handler */}
                <li>
                  <a href="/register" onClick={handleGetStarted} className="landing-link">
                    Get Started <CiLocationArrow1 />
                  </a>
                </li>
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