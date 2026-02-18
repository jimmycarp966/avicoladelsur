'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Logo } from '@/components/ui/logo'

interface ModernLoginLayoutProps {
    children: React.ReactNode
    backgroundImage?: string
}

export function ModernLoginLayout({ children, backgroundImage }: ModernLoginLayoutProps) {
    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F9FBFA] overflow-hidden">
            {/* LADO IZQUIERDO: Visual / Imagen de Galpón */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#2F7058]">
                {/* Imagen de fondo con overlay */}
                <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-in-out hover:scale-105"
                    style={{
                        backgroundImage: `url(${backgroundImage || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop'})`,
                        filter: 'brightness(0.5) contrast(1.1)'
                    }}
                />

                {/* Gradiente de marca */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#2F7058]/80 via-transparent to-black/40" />

                {/* Contenido textual */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative z-10 flex flex-col justify-center px-16 xl:px-24 h-full text-white"
                >
                    <Logo size="xl" variant="full" light className="mb-12" />

                    <div className="space-y-6">
                        <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight">
                            Calidad desde <br />
                            <span className="text-[#FCDE8D]">el origen.</span>
                        </h1>

                        <p className="text-lg xl:text-xl text-white/80 max-w-md font-medium">
                            Eficiencia en cada entrega y tecnología al servicio de la frescura.
                        </p>

                        <div className="pt-8 flex gap-4">
                            <div className="h-1 w-12 bg-[#FCDE8D] rounded-full" />
                            <div className="h-1 w-4 bg-white/30 rounded-full" />
                            <div className="h-1 w-4 bg-white/30 rounded-full" />
                        </div>
                    </div>

                    <div className="absolute bottom-12 left-16 xl:left-24 text-white/40 text-sm font-medium">
                        © 2026 Avícola del Sur · ERP Integral
                    </div>
                </motion.div>
            </div>

            {/* LADO DERECHO: Formulario */}
            <div className="flex-1 flex flex-col relative bg-[#F9FBFA]">
                {/* Micro-textura de ruido (opcional vía CSS o SVG sutil) */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
                />

                {/* Gradiente suave crema */}
                <div className="absolute inset-0 bg-gradient-to-tr from-[#FCDE8D]/5 via-transparent to-transparent pointer-events-none" />

                <div className="flex-1 flex items-center justify-center p-6 sm:p-12 md:p-16 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-md"
                    >
                        {/* Logo visible en móvil */}
                        <div className="lg:hidden flex justify-center mb-8">
                            <Logo size="lg" variant="full" />
                        </div>

                        {children}
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
