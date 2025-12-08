"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
    Environment,
    Float,
    ContactShadows,
} from "@react-three/drei";
import {
    HandLandmarker,
    FilesetResolver,
    NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Camera, MousePointer2, Hand, Grab } from "lucide-react";

// --- Types ---
type ShapeType = "box" | "sphere" | "torus";

// --- 3D Components ---

function InteractiveObject({
    position,
    rotation,
    isPinching,
    shape,
}: {
    position: [number, number, number];
    rotation: [number, number, number];
    isPinching: boolean;
    shape: ShapeType;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);

    // Smooth interpolation for physics-like movement
    useFrame((state, delta) => {
        if (meshRef.current) {
            // Position: Only follow if pinching, otherwise float gently back to center (or stay)
            const targetPos = isPinching ? new THREE.Vector3(...position) : meshRef.current.position.clone();

            // Lerp position
            meshRef.current.position.lerp(targetPos, 0.2); // Snappier when grabbing

            // Rotation: Follow hand rotation if pinching, otherwise idle rotation
            const targetRot = isPinching
                ? new THREE.Euler(...rotation)
                : new THREE.Euler(
                    meshRef.current.rotation.x + 0.01,
                    meshRef.current.rotation.y + 0.01,
                    0
                );

            // Lerp Rotation
            meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.x, 0.1);
            meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.y, 0.1);
            meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRot.z, 0.1);
        }
    });

    const material = (
        <meshStandardMaterial
            color={isPinching ? "#ef4444" : hovered ? "#f59e0b" : "#3b82f6"}
            roughness={0.1}
            metalness={0.8}
        />
    );

    return (
        <Float speed={isPinching ? 0 : 2} rotationIntensity={isPinching ? 0 : 0.5} floatIntensity={isPinching ? 0 : 0.5}>
            <mesh
                ref={meshRef}
                scale={isPinching ? 1.2 : 1}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
            >
                {shape === "box" && <boxGeometry args={[1.5, 1.5, 1.5]} />}
                {shape === "sphere" && <sphereGeometry args={[1, 32, 32]} />}
                {shape === "torus" && <torusGeometry args={[0.8, 0.4, 16, 100]} />}
                {material}
                {/* Wireframe overlay */}
                <mesh scale={[1.02, 1.02, 1.02]}>
                    {shape === "box" && <boxGeometry args={[1.5, 1.5, 1.5]} />}
                    {shape === "sphere" && <sphereGeometry args={[1, 32, 32]} />}
                    {shape === "torus" && <torusGeometry args={[0.8, 0.4, 16, 100]} />}
                    <meshBasicMaterial wireframe color="white" transparent opacity={0.3} />
                </mesh>
            </mesh>
        </Float>
    );
}

function SceneContent({
    handPosition,
    handRotation,
    isPinching,
    shape,
}: {
    handPosition: { x: number; y: number; z: number };
    handRotation: { x: number; y: number; z: number };
    isPinching: boolean;
    shape: ShapeType;
}) {
    // Map normalized coordinates to world space
    // We include Z for depth now!
    const targetX = (handPosition.x - 0.5) * -12; // Invert X for mirror
    const targetY = (handPosition.y - 0.5) * -8;
    const targetZ = handPosition.z * -20; // Depth factor

    return (
        <>
            <ambientLight intensity={0.5} />
            {/* We use standard lights to avoid type issues with SpotLight/divSpotLight */}
            <pointLight position={[10, 10, 10]} intensity={1.5} />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#ff0000" />

            <InteractiveObject
                position={[targetX, targetY, targetZ]}
                rotation={[handRotation.x, handRotation.y, handRotation.z]}
                isPinching={isPinching}
                shape={shape}
            />

            <ContactShadows position={[0, -4.5, 0]} opacity={0.5} scale={20} blur={2.5} far={5} />
            <Environment preset="city" />
        </>
    );
}

// --- Main Component ---

export default function HandGestureDemo() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [handPosition, setHandPosition] = useState({ x: 0.5, y: 0.5, z: 0 });
    const [handRotation, setHandRotation] = useState({ x: 0, y: 0, z: 0 });
    const [isPinching, setIsPinching] = useState(false);
    const [currentShape, setCurrentShape] = useState<ShapeType>("box");
    const [status, setStatus] = useState("Iniciando...");
    const [gestureName, setGestureName] = useState("Esperando...");

    // Cooldown for shape switching to prevent rapid toggling
    const lastSwitchTime = useRef(0);
    const requestRef = useRef<number>(0);

    const handLandmarkerRef = useRef<HandLandmarker | null>(null);

    useEffect(() => {
        const setupMediaPipe = async () => {
            try {
                setStatus("Cargando modelo IA...");
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );

                handLandmarkerRef.current = await HandLandmarker.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                            delegate: "GPU",
                        },
                        runningMode: "VIDEO",
                        numHands: 1,
                    }
                );

                setIsLoaded(true);
                setStatus("Esperando cámara...");
            } catch (error) {
                console.error("Error MediaPipe:", error);
                setStatus("Error de carga. Recarga la página.");
            }
        };

        setupMediaPipe();

        return () => {
            if (handLandmarkerRef.current) handLandmarkerRef.current.close();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const enableCam = async () => {
        if (!handLandmarkerRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", predictWebcam);
                setPermissionGranted(true);
            }
        } catch (err) {
            console.error(err);
            setStatus("Permiso denegado.");
        }
    };

    const detectGestures = (landmarks: NormalizedLandmark[]) => {
        // 1. PINCH: Distance between Thumb Tip (4) and Index Tip (8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const isPinchingNow = pinchDist < 0.05; // Adjustable threshold

        // 2. ROTATION/ORIENTATION
        const wrist = landmarks[0];
        const middleMCP = landmarks[9];

        // Simple mapping for demo purposes
        const indexMCP = landmarks[5];
        const pinkyMCP = landmarks[17];

        // Roll calculation
        const roll = Math.atan2(pinkyMCP.y - indexMCP.y, pinkyMCP.x - indexMCP.x);

        // Pitch/Yaw based on hand tilt relative to screen plane
        const pitch = (middleMCP.y - wrist.y) * 3;
        const yaw = (middleMCP.x - wrist.x) * -3;

        setHandRotation({ x: pitch, y: yaw, z: roll });

        // 3. VICTORY SIGN (Changing Shapes)
        const isIndexExtended = landmarks[8].y < landmarks[6].y;
        const isMiddleExtended = landmarks[12].y < landmarks[10].y;
        const isRingCurled = landmarks[16].y > landmarks[14].y;
        const isPinkyCurled = landmarks[20].y > landmarks[18].y;

        const isVictory = isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled && !isPinchingNow;

        if (isPinchingNow) {
            setGestureName("AGARRANDO");
            setIsPinching(true);
            // Only update position if pinching (Grab mechanics)
            setHandPosition({ x: indexTip.x, y: indexTip.y, z: indexTip.z });
        } else if (isVictory) {
            setGestureName("CAMBIO DE FORMA");
            setIsPinching(false);

            // Cooldown check
            const now = Date.now();
            if (now - lastSwitchTime.current > 1000) {
                setCurrentShape(prev => {
                    if (prev === 'box') return 'sphere';
                    if (prev === 'sphere') return 'torus';
                    return 'box';
                });
                lastSwitchTime.current = now;
            }
        } else {
            setGestureName("Rastreo Activo");
            setIsPinching(false);
        }
    };

    const predictWebcam = () => {
        if (!videoRef.current || !handLandmarkerRef.current) return;
        const startTimeMs = performance.now();
        if (videoRef.current.currentTime !== 0) {
            const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
            if (results.landmarks && results.landmarks.length > 0) {
                detectGestures(results.landmarks[0]);
            }
        }
        requestRef.current = window.requestAnimationFrame(predictWebcam);
    };

    return (
        <div className="relative w-full h-screen bg-neutral-950 overflow-hidden text-white font-sans select-none">
            {/* 3D Scene */}
            <div className="absolute inset-0 z-0 cursor-move">
                <Canvas shadows camera={{ position: [0, 0, 8], fov: 45 }}>
                    <Suspense fallback={null}>
                        <SceneContent
                            handPosition={handPosition}
                            handRotation={handRotation}
                            isPinching={isPinching}
                            shape={currentShape}
                        />
                    </Suspense>
                </Canvas>
            </div>

            <video ref={videoRef} className="hidden" autoPlay playsInline muted />

            {/* UI Overlay */}
            <div className="absolute inset-0 z-20 pointer-events-none p-6 md:p-12 flex flex-col justify-between">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <motion.h1
                            layoutId="title"
                            className="text-3xl md:text-5xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 uppercase"
                        >
                            Avícola 3D Lab
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="text-neutral-400 mt-2 font-mono text-sm max-w-sm"
                        >
                            Interfaz gestual experimental.
                        </motion.p>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                        <div className={`px-4 py-2 rounded-lg font-bold font-mono tracking-widest text-xs border backdrop-blur-md transition-colors duration-300 flex items-center gap-2
                    ${isPinching ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                            {isPinching ? <Grab size={16} /> : <Hand size={16} />}
                            {gestureName}
                        </div>
                        <div className="text-xs text-neutral-500 font-mono">
                            SHAPE: {currentShape.toUpperCase()}
                        </div>
                    </div>
                </div>

                {/* Start Prompt */}
                <AnimatePresence>
                    {!permissionGranted && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm z-50"
                        >
                            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                                    {isLoaded ? (
                                        <Camera size={40} className="text-blue-400" />
                                    ) : (
                                        <Loader2 size={40} className="animate-spin text-purple-400" />
                                    )}
                                    {isLoaded && <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/20" />}
                                </div>

                                <h2 className="text-2xl font-bold mb-2">Activación Requerida</h2>
                                <p className="text-neutral-400 mb-8 font-light">{status}</p>

                                <button
                                    onClick={enableCam}
                                    disabled={!isLoaded}
                                    className="w-full bg-white text-black hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {isLoaded ? "INICIAR EXPERIENCIA" : "CARGANDO MODELOS..."}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Instructions Footer */}
                {permissionGranted && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="grid grid-cols-3 gap-4"
                    >
                        <InstructionCard
                            icon={<Grab className="text-red-400" />}
                            title="Agarrar y Mover"
                            desc='Junta pulgar e índice ("Pinch") para tomar control del objeto.'
                            active={isPinching}
                        />
                        <InstructionCard
                            icon={<div className="flex"><Hand className="text-blue-400 -mr-2" /><Hand className="text-blue-400 opacity-50" /></div>}
                            title="Rotar Muñeca"
                            desc="Gira tu mano para rotar el objeto en 3D."
                            active={!isPinching && gestureName === 'Rastreo Activo'}
                        />
                        <InstructionCard
                            icon={<span className="text-xl font-bold text-purple-400">✌️</span>}
                            title="Cambiar Forma"
                            desc='Haz el gesto de "Amor y Paz" para cambiar la geometría.'
                            active={gestureName === 'CAMBIO DE FORMA'}
                        />
                    </motion.div>
                )}
            </div>
        </div >
    );
}

function InstructionCard({ icon, title, desc, active }: { icon: React.ReactNode, title: string, desc: string, active: boolean }) {
    return (
        <div className={`bg-neutral-900/80 backdrop-blur-md p-4 rounded-xl border transition-all duration-300 ${active ? 'border-white/40 bg-neutral-800' : 'border-white/5 opacity-60'}`}>
            <div className="flex items-center gap-3 mb-2">
                {icon}
                <span className="font-bold text-sm text-white">{title}</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
        </div>
    )
}
