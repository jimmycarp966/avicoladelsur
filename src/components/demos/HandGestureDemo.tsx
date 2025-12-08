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
            // Position: SIEMPRE seguir la posición de la mano
            const targetPos = new THREE.Vector3(...position);
            
            // Lerp position - más rápido cuando está agarrando
            const lerpSpeed = isPinching ? 0.3 : 0.15;
            meshRef.current.position.lerp(targetPos, lerpSpeed);

            // Rotation: SIEMPRE seguir la rotación de la mano
            const targetRot = new THREE.Euler(...rotation);

            // Lerp Rotation - más rápido cuando está agarrando
            const rotLerpSpeed = isPinching ? 0.15 : 0.08;
            meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRot.x, rotLerpSpeed);
            meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRot.y, rotLerpSpeed);
            meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRot.z, rotLerpSpeed);
        }
    });

    const material = (
        <meshStandardMaterial
            color={isPinching ? "#CB3433" : hovered ? "#FCDE8D" : "#2F7058"}
            roughness={0.2}
            metalness={0.6}
            emissive={isPinching ? "#CB3433" : "#000000"}
            emissiveIntensity={isPinching ? 0.5 : 0}
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
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#FCDE8D" />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#2F7058" />
            <directionalLight position={[0, 5, 5]} intensity={1} />

            <InteractiveObject
                position={[targetX, targetY, targetZ]}
                rotation={[handRotation.x, handRotation.y, handRotation.z]}
                isPinching={isPinching}
                shape={shape}
            />

            <ContactShadows position={[0, -4.5, 0]} opacity={0.6} scale={20} blur={2.5} far={5} color="#1a2f24" />
            <Environment preset="forest" />
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
                console.log("[HandGesture] Iniciando carga de MediaPipe...");
                
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );
                console.log("[HandGesture] FilesetResolver cargado");

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
                console.log("[HandGesture] HandLandmarker creado exitosamente");

                setIsLoaded(true);
                setStatus("Esperando cámara...");
            } catch (error) {
                console.error("[HandGesture] Error MediaPipe:", error);
                setStatus("Error de carga. Recarga la página.");
            }
        };

        setupMediaPipe();

        return () => {
            console.log("[HandGesture] Limpiando recursos...");
            if (handLandmarkerRef.current) {
                handLandmarkerRef.current.close();
                handLandmarkerRef.current = null;
            }
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
                requestRef.current = 0;
            }
        };
    }, []);

    const enableCam = async () => {
        console.log("Attempting to enable camera...");
        if (!handLandmarkerRef.current) {
            console.error("handLandmarker not ready");
            setStatus("Error: Modelo IA no listo. Recarga la página.");
            return;
        }

        setStatus("Solicitando permiso... Mira la barra de dirección 🔒");

        try {
            // Simplest constraint to maximize compatibility
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            console.log("Camera access granted:", stream.id);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                
                // Esperar a que el video esté listo antes de iniciar la detección
                videoRef.current.addEventListener("loadeddata", () => {
                    console.log("[HandGesture] Video loaded, dimensiones:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
                    setPermissionGranted(true);
                    setStatus("¡Cámara activa!");
                    // Iniciar el loop de detección después de un pequeño delay para asegurar que el video esté reproduciéndose
                    setTimeout(() => {
                        if (requestRef.current) {
                            cancelAnimationFrame(requestRef.current);
                        }
                        console.log("[HandGesture] Iniciando loop de detección...");
                        predictWebcam();
                    }, 100);
                }, { once: true });
                
                // También iniciar cuando el video empiece a reproducirse
                videoRef.current.addEventListener("playing", () => {
                    console.log("[HandGesture] Video playing, ensuring detection loop is running...");
                    if (!requestRef.current) {
                        predictWebcam();
                    }
                }, { once: true });
                
                // Forzar reproducción del video
                videoRef.current.play().catch(err => {
                    console.error("[HandGesture] Error al reproducir video:", err);
                });
            }
        } catch (err: any) {
            console.error("Error accessing webcam:", err);

            // Helpful error messages for the user
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setStatus("⛔ Permiso denegado. Haz clic en el candado 🔒 de la barra de URL y permite la cámara.");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setStatus("📷 No se encontró ninguna cámara.");
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setStatus("⚠️ La cámara está siendo usada por otra aplicación.");
            } else {
                setStatus(`Error: ${err.message || 'Desconocido'}`);
            }
        }
    };

    const detectGestures = (landmarks: NormalizedLandmark[]) => {
        // 1. PINCH: Distance between Thumb Tip (4) and Index Tip (8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const isPinchingNow = pinchDist < 0.08; // INCREASED THRESHOLD: Was 0.05

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
        // Relaxed logic: Index and Middle tips above their PIP joints; Ring and Pinky tips below their PIP joints
        const isIndexExtended = landmarks[8].y < landmarks[6].y;
        const isMiddleExtended = landmarks[12].y < landmarks[10].y;
        const isRingCurled = landmarks[16].y > landmarks[14].y;
        const isPinkyCurled = landmarks[20].y > landmarks[18].y;

        const isVictory = isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled && !isPinchingNow;

        // SIEMPRE actualizar la posición de la mano (usando el índice como referencia)
        setHandPosition({ x: indexTip.x, y: indexTip.y, z: indexTip.z });

        if (isPinchingNow) {
            setGestureName("AGARRANDO");
            setIsPinching(true);
        } else if (isVictory) {
            setGestureName("CAMBIO DE FORMA");
            setIsPinching(false);

            // Cooldown check
            const now = Date.now();
            if (now - lastSwitchTime.current > 1500) { // Increased cooldown slightly to avoid double triggers
                console.log("Shape switch triggered!");
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
        if (!videoRef.current || !handLandmarkerRef.current) {
            console.warn("[HandGesture] Video or handLandmarker not ready");
            requestRef.current = window.requestAnimationFrame(predictWebcam);
            return;
        }

        // Verificar que el video esté reproduciéndose y tenga dimensiones válidas
        if (videoRef.current.readyState < 2) {
            // Video aún no está listo, reintentar en el siguiente frame
            requestRef.current = window.requestAnimationFrame(predictWebcam);
            return;
        }

        // Verificar que el video tenga dimensiones válidas
        if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
            requestRef.current = window.requestAnimationFrame(predictWebcam);
            return;
        }

        const startTimeMs = performance.now();
        
        try {
            const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
            
            if (results && results.landmarks && results.landmarks.length > 0) {
                detectGestures(results.landmarks[0]);
            } else {
                // Feedback when hands are lost
                setGestureName("NO SE DETECTA MANO");
                setIsPinching(false);
            }
        } catch (error) {
            console.error("[HandGesture] Error en detectForVideo:", error);
            setGestureName("ERROR DE DETECCIÓN");
        }
        
        // Continuar el loop
        requestRef.current = window.requestAnimationFrame(predictWebcam);
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#0E131B] overflow-hidden text-[#F5F7F9] font-sans select-none z-[50]">
            {/* Webcam Feed - Visible now for debugging/positioning */}
            <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 transition-opacity duration-1000 ${permissionGranted ? 'opacity-20' : 'opacity-0'}`}
                autoPlay
                playsInline
                muted
            />

            {/* 3D Scene */}
            <div className="absolute inset-0 z-10 cursor-move">
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

            {/* UI Overlay */}
            <div className="absolute inset-0 z-20 pointer-events-none p-6 md:p-12 flex flex-col justify-between">
                {/* Header */}
                <div className="flex justify-between items-start pointer-events-auto">
                    <div>
                        <motion.div
                            layoutId="logo"
                            className="flex items-center gap-2 mb-2"
                        >
                            <div className="w-8 h-8 rounded-lg bg-[#2F7058] grid place-items-center overflow-hidden">
                                <img src="/images/favicon.svg" alt="Avícola Logo" className="w-6 h-6 object-contain" />
                            </div>
                            <span className="font-bold tracking-tight text-[#2F7058] bg-[#FCDE8D] px-2 py-0.5 rounded text-xs">EXPERIMENTAL</span>
                        </motion.div>

                        <motion.h1
                            layoutId="title"
                            className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase drop-shadow-sm"
                        >
                            <span className="text-[#FCDE8D]">Avícola</span> 3D
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="text-[#9ca3af] mt-2 font-mono text-sm max-w-sm"
                        >
                            Control gestual para logística.
                        </motion.p>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                        <div className={`px-4 py-2 rounded-lg font-bold font-mono tracking-widest text-xs border backdrop-blur-md transition-colors duration-300 flex items-center gap-2
                    ${isPinching ? 'bg-[#CB3433]/20 border-[#CB3433] text-[#CB3433]' : 'bg-[#2F7058]/20 border-[#2F7058] text-[#2F7058] bg-white/5'}`}>
                            {isPinching ? <Grab size={16} /> : <Hand size={16} />}
                            {gestureName}
                        </div>
                        <div className="text-xs text-[#FCDE8D] font-mono opacity-80">
                            SHAPE: {currentShape.toUpperCase()}
                        </div>
                        {/* Debug info */}
                        <div className="text-xs text-[#9ca3af] font-mono opacity-60 mt-2 text-right">
                            POS: ({handPosition.x.toFixed(2)}, {handPosition.y.toFixed(2)}, {handPosition.z.toFixed(2)})
                        </div>
                    </div>
                </div>

                {/* Start Prompt */}
                <AnimatePresence>
                    {!permissionGranted && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 flex items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-md z-[100]"
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

                                <h2 className="text-2xl font-bold mb-2 text-[#FCDE8D]">Activación Requerida</h2>
                                <p className="text-[#9ca3af] mb-8 font-light">{status}</p>

                                <button
                                    onClick={() => {
                                        console.log("Button clicked!");
                                        enableCam();
                                    }}
                                    disabled={!isLoaded || status.includes("Solicitando")}
                                    className="w-full cursor-pointer bg-[#2F7058] hover:bg-[#3d8a6f] text-white disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2F7058]/20 active:scale-95 z-50 relative"
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
                        className="grid grid-cols-3 gap-4 pointer-events-auto"
                    >
                        <InstructionCard
                            icon={<Grab className="text-[#CB3433]" />}
                            title="Agarrar y Mover"
                            desc='Junta pulgar e índice ("Pinch") para tomar control del objeto.'
                            active={isPinching}
                        />
                        <InstructionCard
                            icon={<div className="flex"><Hand className="text-[#2F7058] -mr-2" /><Hand className="text-[#2F7058] opacity-50" /></div>}
                            title="Rotar Muñeca"
                            desc="Gira tu mano para rotar el objeto en 3D."
                            active={!isPinching && gestureName === 'Rastreo Activo'}
                        />
                        <InstructionCard
                            icon={<span className="text-xl font-bold text-[#FCDE8D]">✌️</span>}
                            title="Cambiar Forma"
                            desc='Haz el gesto de "Amor y Paz" para cambiar la geometría.'
                            active={gestureName === 'CAMBIO DE FORMA'}
                        />
                    </motion.div>
                )}
            </div>
        </div>
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
