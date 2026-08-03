import * as ImagePicker from 'expo-image-picker';
import { getPublicUrl, supabase } from './supabase';

export interface UploadResult {
  path: string;
  publicUrl: string;
}

const BUCKET = 'pfp'; // Create this bucket in Supabase Storage

export async function pickImage(): Promise<string | null> {
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

// No need for manual blob conversion; fetch(uri).blob() works in Expo

export async function uploadPfp(userId: string, uri: string): Promise<UploadResult> {
  const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${userId}/${Date.now()}.${fileExt}`;

  // React Native compatible: use arrayBuffer instead of blob
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
