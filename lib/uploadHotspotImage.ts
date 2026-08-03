import * as ImagePicker from 'expo-image-picker';
import { getPublicUrl, supabase } from './supabase';

export interface UploadResult {
  path: string;
  publicUrl: string;
}

const BUCKET = 'hotspots'; // Create this bucket in Supabase Storage

export async function pickHotspotImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access media library is required');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  return asset?.uri ?? null;
}

export async function uploadHotspotImage(ownerId: string, uri: string): Promise<UploadResult> {
  const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${ownerId}/${Date.now()}.${fileExt}`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { data, error } = await supabase.storage.from(BUCKET).upload(
    filePath,
    arrayBuffer,
    {
      contentType: `image/${fileExt}`,
      upsert: true,
    }
  );

  if (error) throw error;

  const publicUrl = await getPublicUrl(BUCKET, filePath);
  return { path: data?.path || filePath, publicUrl };
}
