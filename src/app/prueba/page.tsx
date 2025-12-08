"use client";

import React, { Suspense } from 'react';
import HandGestureDemo from '@/components/demos/HandGestureDemo';

export default function PruebaPage() {
    return (
        <Suspense fallback={<div className="text-white text-center p-10">Cargando...</div>}>
            <HandGestureDemo />
        </Suspense>
    );
}
