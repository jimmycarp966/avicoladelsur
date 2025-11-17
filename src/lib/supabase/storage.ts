import { createClient } from './client'

/**
 * Helper para subir archivos a Supabase Storage
 */
export async function uploadFileToStorage(
  bucket: string,
  file: File,
  path?: string
): Promise<{ url: string; path: string }> {
  const supabase = createClient()
  
  // Generar nombre único si no se proporciona path
  const fileName = path || `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(`Error al subir archivo: ${error.message}`)
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)

  return {
    url: urlData.publicUrl,
    path: data.path,
  }
}

/**
 * Helper para eliminar archivos de Storage
 */
export async function deleteFileFromStorage(bucket: string, path: string): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase.storage.from(bucket).remove([path])

  if (error) {
    throw new Error(`Error al eliminar archivo: ${error.message}`)
  }
}

