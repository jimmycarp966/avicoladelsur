"use client";

import React, { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import {
    HandLandmarker,
    FilesetResolver,
    NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Camera, Heart, Flower2, Sparkles, CircleDot, Flame, Star } from "lucide-react";

// --- Types ---
type ShapeTemplate = "heart" | "flower" | "saturn" | "buddha" | "fireworks" | "spiral";

interface HandData {
    landmarks: NormalizedLandmark[];
    isFist: boolean;
}

// --- Shape Generators ---
const generateHeartPoints = (count: number): Float32Array => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const z = (Math.random() - 0.5) * 5;
        positions[i * 3] = x * 0.1 + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = y * 0.1 + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 2] = z * 0.1;
    }
    return positions;
};

const generateFlowerPoints = (count: number): Float32Array => {
    const positions = new Float32Array(count * 3);
    const petals = 6;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 * petals;
        const r = 2 + Math.sin(angle * petals) * 1.5;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const z = (Math.random() - 0.5) * 1;
        positions[i * 3] = x + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 2] = z;
    }
    return positions;
};

const generateSaturnPoints = (count: number): Float32Array => {
    const positions = new Float32Array(count * 3);
    const planetParticles = Math.floor(count * 0.4);
    // Planet (sphere)
    for (let i = 0; i < planetParticles; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1.2;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
    }
    // Rings
    for (let i = planetParticles; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 1.5;
        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    return positions;
};

const generateBuddhaPoints = (count: number): Float32Array => {
    const positions = new Float32Array(count * 3);
    // Simplified Buddha silhouette using layered shapes
    for (let i = 0; i < count; i++) {
        const section = Math.random();
        let x, y, z;
        if (section < 0.3) {
            // Head (circle)
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.8;
            x = Math.cos(angle) * r;
            y = 2.5 + Math.sin(angle) * r * 0.8;
            z = (Math.random() - 0.5) * 0.5;
        } else if (section < 0.7) {
            // Body (wider ellipse)
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 1.5;
            x = Math.cos(angle) * r;
            y = Math.sin(angle) * r * 0.6;
            z = (Math.random() - 0.5) * 0.8;
        } else {
            // Lotus base
            const angle = Math.random() * Math.PI * 2;
            const r = 1 + Math.random() * 0.8;
            x = Math.cos(angle) * r;
            y = -1.5 + Math.sin(angle * 3) * 0.3;
            z = (Math.random() - 0.5) * 0.3;
        }
        positions[i * 3] = x + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 2] = z;
    }
    return positions;
};

const generateFireworksPoints = (count: number): Float32Array => {
    const positions = new Float32Array(count * 3);
    const numBursts = 5;
    const particlesPerBurst = Math.floor(count / numBursts);
    for (let burst = 0; burst < numBursts; burst++) {
        const cx = (Math.random() - 0.5) * 6;
        const cy = (Math.random() - 0.5) * 4 + 1;
        const cz = (Math.random() - 0.5) * 2;
        for (let i = 0; i < particlesPerBurst; i++) {
            const idx = burst * particlesPerBurst + i;
            if (idx >= count) break;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = Math.random() * 1.5;
            positions[idx * 3] = cx + r * Math.sin(phi) * Math.cos(theta);
            positions[idx * 3 + 1] = cy + r * Math.sin(phi) * Math.sin(theta);
            positions[idx * 3 + 2] = cz + r * Math.cos(phi);
        }
    }
    return positions;
};

const generateSpiralPoints = (count: number): Float32Array => {
    const positions = new Float32Array(count * 3);
    const arms = 3;
    for (let i = 0; i < count; i++) {
        const arm = i % arms;
        const t = (i / count) * 8;
        const angle = t + (arm * Math.PI * 2) / arms;
        const r = t * 0.5;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const z = (Math.random() - 0.5) * 0.5;
        positions[i * 3] = x + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
        positions[i * 3 + 2] = z;
    }
    return positions;
};

const shapeGenerators: Record<ShapeTemplate, (count: number) => Float32Array> = {
    heart: generateHeartPoints,
    flower: generateFlowerPoints,
    saturn: generateSaturnPoints,
    buddha: generateBuddhaPoints,
    fireworks: generateFireworksPoints,
    spiral: generateSpiralPoints,
};

// --- Particle System Component ---
function ParticleCloud({
    shape,
    color,
    scale,
    particleCount,
}: {
    shape: ShapeTemplate;
    color: string;
    scale: number;
    particleCount: number;
}) {
    const pointsRef = useRef<THREE.Points>(null);
    const positionsRef = useRef<Float32Array | null>(null);
    const targetPositionsRef = useRef<Float32Array | null>(null);
    const velocitiesRef = useRef<Float32Array | null>(null);

    // Initialize or update shape
    useEffect(() => {
        const newPositions = shapeGenerators[shape](particleCount);
        targetPositionsRef.current = newPositions;

        if (!positionsRef.current || positionsRef.current.length !== newPositions.length) {
            positionsRef.current = new Float32Array(newPositions);
            velocitiesRef.current = new Float32Array(particleCount * 3);
        }
    }, [shape, particleCount]);

    useFrame((state, delta) => {
        if (!pointsRef.current || !positionsRef.current || !targetPositionsRef.current || !velocitiesRef.current) return;

        const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
        const targets = targetPositionsRef.current;
        const velocities = velocitiesRef.current;

        // Spring physics for smooth transitions
        const stiffness = 2.0;
        const damping = 0.85;

        for (let i = 0; i < particleCount * 3; i++) {
            const force = (targets[i] * scale - positions[i]) * stiffness;
            velocities[i] = velocities[i] * damping + force * delta;
            positions[i] += velocities[i];
        }

        // Rotation animation
        pointsRef.current.rotation.y += delta * 0.1;
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    const initialPositions = shapeGenerators[shape](particleCount);

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={particleCount}
                    array={initialPositions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.08}
                color={color}
                transparent
                opacity={0.9}
                sizeAttenuation
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

function Scene({
    shape,
    color,
    scale,
    particleCount,
}: {
    shape: ShapeTemplate;
    color: string;
    scale: number;
    particleCount: number;
}) {
    return (
        <>
            <ambientLight intensity={0.3} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <ParticleCloud shape={shape} color={color} scale={scale} particleCount={particleCount} />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
            <Environment preset="night" />
        </>
    );
}

// --- Template Button ---
function TemplateButton({
    template,
    icon,
    label,
    isActive,
    onClick,
}: {
    template: ShapeTemplate;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300 ${isActive
                    ? "bg-white/20 border-white/40 scale-105"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                } border backdrop-blur-md`}
        >
            <div className={`${isActive ? "text-white" : "text-white/60"}`}>{icon}</div>
            <span className={`text-xs ${isActive ? "text-white" : "text-white/60"}`}>{label}</span>
        </button>
    );
}

// --- Color Presets ---
const colorPresets = [
    { name: "Rojo", color: "#ff3366" },
    { name: "Azul", color: "#3366ff" },
    { name: "Verde", color: "#33ff66" },
    { name: "Dorado", color: "#ffcc33" },
    { name: "Púrpura", color: "#9933ff" },
    { name: "Cyan", color: "#33ffff" },
    { name: "Rosa", color: "#ff66cc" },
    { name: "Blanco", color: "#ffffff" },
];

// --- Main Component ---
export default function HandGestureDemo() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [currentShape, setCurrentShape] = useState<ShapeTemplate>("heart");
    const [particleColor, setParticleColor] = useState("#ff3366");
    const [particleScale, setParticleScale] = useState(1);
    const [status, setStatus] = useState("Iniciando...");
    const [handsDetected, setHandsDetected] = useState(0);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const particleCount = 2000;

    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const requestRef = useRef<number>(0);

    // Calculate if hand is making a fist
    const isFist = useCallback((landmarks: NormalizedLandmark[]): boolean => {
        // Check if fingers are curled (tips below knuckles)
        const fingerTips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky tips
        const fingerKnuckles = [6, 10, 14, 18]; // Corresponding knuckles

        let curledCount = 0;
        for (let i = 0; i < 4; i++) {
            if (landmarks[fingerTips[i]].y > landmarks[fingerKnuckles[i]].y) {
                curledCount++;
            }
        }
        return curledCount >= 3;
    }, []);

    // Calculate distance between two hands
    const calculateHandDistance = useCallback((hand1: NormalizedLandmark[], hand2: NormalizedLandmark[]): number => {
        const palm1 = hand1[0]; // Wrist
        const palm2 = hand2[0];
        return Math.hypot(palm1.x - palm2.x, palm1.y - palm2.y);
    }, []);

    useEffect(() => {
        const setupMediaPipe = async () => {
            try {
                setStatus("Cargando modelo IA...");
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );

                handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU",
                    },
                    runningMode: "VIDEO",
                    numHands: 2, // Detect both hands!
                });

                setIsLoaded(true);
                setStatus("Modelo listo. Activa la cámara.");
            } catch (error) {
                console.error("Error MediaPipe:", error);
                setStatus("Error de carga. Recarga la página.");
            }
        };

        setupMediaPipe();

        return () => {
            if (handLandmarkerRef.current) {
                handLandmarkerRef.current.close();
            }
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, []);

    const enableCam = async () => {
        if (!handLandmarkerRef.current) {
            setStatus("Error: Modelo no listo.");
            return;
        }

        setStatus("Solicitando permiso de cámara...");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", () => {
                    setPermissionGranted(true);
                    setStatus("¡Cámara activa!");
                    setTimeout(() => predictWebcam(), 100);
                }, { once: true });
                videoRef.current.play();
            }
        } catch (err: any) {
            if (err.name === "NotAllowedError") {
                setStatus("⛔ Permiso denegado. Permite la cámara.");
            } else if (err.name === "NotFoundError") {
                setStatus("📷 No se encontró cámara.");
            } else {
                setStatus(`Error: ${err.message}`);
            }
        }
    };

    const predictWebcam = () => {
        if (!videoRef.current || !handLandmarkerRef.current) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }

        if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }

        const startTimeMs = performance.now();
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

        if (results?.landmarks && results.landmarks.length > 0) {
            setHandsDetected(results.landmarks.length);

            if (results.landmarks.length === 2) {
                // Two hands detected - calculate distance for scale
                const distance = calculateHandDistance(results.landmarks[0], results.landmarks[1]);
                // Map distance (0.1 - 0.8) to scale (0.5 - 2.0)
                const newScale = THREE.MathUtils.mapLinear(distance, 0.1, 0.8, 0.5, 2.5);
                setParticleScale(THREE.MathUtils.clamp(newScale, 0.3, 3));

                // Check if both fists are closed for contraction effect
                const bothFists = isFist(results.landmarks[0]) && isFist(results.landmarks[1]);
                if (bothFists) {
                    setParticleScale(prev => Math.max(0.3, prev * 0.95));
                }
            } else if (results.landmarks.length === 1) {
                // Single hand - fist controls scale
                if (isFist(results.landmarks[0])) {
                    setParticleScale(prev => Math.max(0.3, prev * 0.98));
                } else {
                    setParticleScale(prev => Math.min(2, prev * 1.01));
                }
            }
        } else {
            setHandsDetected(0);
        }

        requestRef.current = requestAnimationFrame(predictWebcam);
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] overflow-hidden text-white font-sans select-none">
            {/* Hidden Video */}
            <video
                ref={videoRef}
                className="absolute opacity-0 pointer-events-none"
                autoPlay
                playsInline
                muted
            />

            {/* 3D Canvas */}
            <div className="absolute inset-0">
                <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
                    <Suspense fallback={null}>
                        <Scene
                            shape={currentShape}
                            color={particleColor}
                            scale={particleScale}
                            particleCount={particleCount}
                        />
                    </Suspense>
                </Canvas>
            </div>

            {/* UI Overlay */}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                {/* Header */}
                <div className="flex justify-between items-start pointer-events-auto">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-6 h-6 text-purple-400" />
                            <span className="font-bold text-purple-400 text-sm">PARTICLE SYSTEM</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                            Control <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">Gestual</span>
                        </h1>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col items-end gap-2">
                        <div className={`px-4 py-2 rounded-full text-sm font-mono backdrop-blur-md border ${handsDetected > 0 ? "bg-green-500/20 border-green-500/40 text-green-400" : "bg-white/10 border-white/20"
                            }`}>
                            {handsDetected > 0 ? `${handsDetected} mano${handsDetected > 1 ? "s" : ""} detectada${handsDetected > 1 ? "s" : ""}` : "Sin manos"}
                        </div>
                        <div className="text-xs text-white/50 font-mono">
                            Escala: {particleScale.toFixed(2)}x
                        </div>
                    </div>
                </div>

                {/* Bottom Controls */}
                <div className="pointer-events-auto">
                    {/* Template Selection */}
                    <div className="flex justify-center gap-2 mb-4 flex-wrap">
                        <TemplateButton
                            template="heart"
                            icon={<Heart size={20} />}
                            label="Corazón"
                            isActive={currentShape === "heart"}
                            onClick={() => setCurrentShape("heart")}
                        />
                        <TemplateButton
                            template="flower"
                            icon={<Flower2 size={20} />}
                            label="Flor"
                            isActive={currentShape === "flower"}
                            onClick={() => setCurrentShape("flower")}
                        />
                        <TemplateButton
                            template="saturn"
                            icon={<CircleDot size={20} />}
                            label="Saturno"
                            isActive={currentShape === "saturn"}
                            onClick={() => setCurrentShape("saturn")}
                        />
                        <TemplateButton
                            template="buddha"
                            icon={<span className="text-lg">🧘</span>}
                            label="Buda"
                            isActive={currentShape === "buddha"}
                            onClick={() => setCurrentShape("buddha")}
                        />
                        <TemplateButton
                            template="fireworks"
                            icon={<Flame size={20} />}
                            label="Fuegos"
                            isActive={currentShape === "fireworks"}
                            onClick={() => setCurrentShape("fireworks")}
                        />
                        <TemplateButton
                            template="spiral"
                            icon={<Star size={20} />}
                            label="Espiral"
                            isActive={currentShape === "spiral"}
                            onClick={() => setCurrentShape("spiral")}
                        />
                    </div>

                    {/* Color Picker */}
                    <div className="flex justify-center gap-2 mb-4">
                        {colorPresets.map((preset) => (
                            <button
                                key={preset.color}
                                onClick={() => setParticleColor(preset.color)}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${particleColor === preset.color ? "border-white scale-110" : "border-transparent hover:scale-105"
                                    }`}
                                style={{ backgroundColor: preset.color }}
                                title={preset.name}
                            />
                        ))}
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="w-8 h-8 rounded-full border-2 border-dashed border-white/50 flex items-center justify-center text-white/50 hover:border-white hover:text-white transition-all"
                        >
                            +
                        </button>
                    </div>

                    {/* Custom Color Picker */}
                    <AnimatePresence>
                        {showColorPicker && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="flex justify-center mb-4"
                            >
                                <input
                                    type="color"
                                    value={particleColor}
                                    onChange={(e) => setParticleColor(e.target.value)}
                                    className="w-32 h-10 rounded-lg cursor-pointer"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Instructions */}
                    {permissionGranted && (
                        <div className="text-center text-white/50 text-sm">
                            <span className="mr-4">✋ Separa las manos → Expande</span>
                            <span className="mr-4">🤲 Junta las manos → Comprime</span>
                            <span>✊ Puños cerrados → Contrae</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Start Modal */}
            <AnimatePresence>
                {!permissionGranted && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-md z-50"
                    >
                        <div className="bg-white/10 border border-white/20 p-8 rounded-2xl max-w-md w-full text-center backdrop-blur-xl">
                            <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                {isLoaded ? (
                                    <Camera size={40} className="text-white" />
                                ) : (
                                    <Loader2 size={40} className="animate-spin text-white" />
                                )}
                            </div>

                            <h2 className="text-2xl font-bold mb-2">Sistema de Partículas 3D</h2>
                            <p className="text-white/60 mb-6">{status}</p>

                            <button
                                onClick={enableCam}
                                disabled={!isLoaded}
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-6 rounded-xl transition-all"
                            >
                                {isLoaded ? "INICIAR EXPERIENCIA" : "CARGANDO..."}
                            </button>

                            <p className="text-white/40 text-xs mt-4">
                                Requiere cámara para control gestual
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
