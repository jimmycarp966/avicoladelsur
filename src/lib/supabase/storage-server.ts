import { createAdminClient, createClient } from './server'

/**
 * Helper para subir archivos a Supabase Storage (server-side)
 */
export async function uploadFileToStorageServer(
  bucket: string,
  file: File | Buffer,
  path?: string,
  contentType?: string
): Promise<{ url: string; path: string }> {
  const supabase = await createClient()
  
  // Generar nombre único si no se proporciona path
  const fileName = path || `${Date.now()}-${file instanceof File ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'file'}`
  
  const fileData = file instanceof File ? await file.arrayBuffer() : file
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileData, {
      cacheControl: '3600',
      upsert: false,
      contentType: contentType || (file instanceof File ? file.type : 'application/octet-stream'),
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

export async function uploadFileToPrivateStorageServer(
  bucket: string,
  file: File | Buffer,
  path: string,
  contentType?: string,
): Promise<{ path: string }> {
  const supabase = createAdminClient()
  const fileData = file instanceof File ? await file.arrayBuffer() : file

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileData, {
      cacheControl: '3600',
      upsert: true,
      contentType: contentType || (file instanceof File ? file.type : 'application/octet-stream'),
    })

  if (error) {
    throw new Error(`Error al subir archivo privado: ${error.message}`)
  }

  return {
    path: data.path,
  }
}

export async function createSignedStorageUrlServer(
  bucket: string,
  path?: string | null,
  expiresIn = 60 * 60,
): Promise<string | null> {
  if (!path) {
    return null
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw new Error(`Error al crear URL firmada: ${error.message}`)
  }

  return data.signedUrl
}

