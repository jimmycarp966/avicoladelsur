import { getGoogleAuthClient, isGoogleCloudConfigured } from '../services/google-cloud/auth';

async function checkAuth() {
    console.log('🔍 Verificando configuración de Google Cloud...');
    const configured = isGoogleCloudConfigured();
    console.log(`Configurado: ${configured}`);

    if (configured) {
        try {
            console.log('🔑 Intentando obtener cliente de autenticación...');
            const auth = getGoogleAuthClient();
            const projectId = await auth.getProjectId();
            console.log(`✅ Autenticación exitosa. Project ID: ${projectId}`);
        } catch (error) {
            console.error('❌ Error obteniendo cliente:', error);
        }
    } else {
        console.log('⚠️ Google Cloud no está configurado correctamente en variables de entorno.');
    }
}

checkAuth();
