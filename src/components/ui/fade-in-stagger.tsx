'use client'

import { motion } from 'framer-motion'

export function FadeInStagger({ children, index = 0, className }: { children: React.ReactNode; index?: number; className?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={className}
        >
            {children}
        </motion.div>
    )
}
