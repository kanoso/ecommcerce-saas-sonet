import type { CloudinaryUploadResponse } from '@/types/wallet.types';

export async function uploadPhoto(uri: string): Promise<string> {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) {
    throw new Error(
      'Cloudinary no configurado: faltan EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME o EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.',
    );
  }

  const filename = uri.split('/').pop() ?? 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const mime = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

  const form = new FormData();
  form.append('file', { uri, name: filename, type: mime } as unknown as Blob);
  form.append('upload_preset', preset);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(`Error al subir la foto (${res.status}), intenta de nuevo.`);
  }
  const json: CloudinaryUploadResponse = await res.json();
  if (!json.secure_url) {
    throw new Error('Cloudinary no devolvió la URL de la foto.');
  }
  return json.secure_url;
}
