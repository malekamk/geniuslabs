import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { supabase } from './supabase';

export async function uploadToStorage(
  bucket: string,
  path: string,
  uri: string,
  mimeType: string,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  const result = await uploadAsync(url, uri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType,
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    const msg = (() => { try { return JSON.parse(result.body)?.message; } catch { return result.body; } })();
    throw new Error(msg ?? `Upload failed (${result.status})`);
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
