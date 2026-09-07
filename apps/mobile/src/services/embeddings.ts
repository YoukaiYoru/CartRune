import { Platform } from 'react-native';

const FALLBACK_HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const HOST = process.env.EXPO_PUBLIC_API_HOST || FALLBACK_HOST;
const EMBEDDINGS_BASE = `http://${HOST}:8700`;

interface EmbedResponse {
  embedding: number[];
}

export async function embedPhoto(uri: string): Promise<number[]> {
  const form = new FormData();
  form.append('image', {
    uri,
    name: 'cover.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const resp = await fetch(`${EMBEDDINGS_BASE}/embed`, {
    method: 'POST',
    body: form,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`embedding failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as EmbedResponse;
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('empty embedding response');
  }
  return data.embedding;
}