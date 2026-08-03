import * as ImagePicker from 'expo-image-picker';
import { getPublicUrl, supabase } from './supabase';

export interface UploadResult {
  path: string;
  publicUrl: string;
}

const BUCKET = 'posts'; // Ensure this bucket exists in Supabase Storage

export async function pickPostMedia(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access media library is required');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
  });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  return asset?.uri ?? null;
}

export async function uploadPostMedia(uri: string): Promise<UploadResult> {
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const rand = Math.random().toString(36).slice(2);
  const filePath = `${Date.now()}_${rand}.${ext}`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { data, error } = await supabase.storage.from(BUCKET).upload(
    filePath,
    arrayBuffer,
    {
      contentType: `image/${ext}`,
      upsert: true,
    }
  );

  if (error) throw error;
  const publicUrl = await getPublicUrl(BUCKET, data?.path || filePath);
  return { path: data?.path || filePath, publicUrl };
}
