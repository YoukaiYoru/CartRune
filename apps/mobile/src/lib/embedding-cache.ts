const cache = new Map<string, number[]>();

export function setEmbedding(photoUri: string, embedding: number[]) {
  cache.set(photoUri, embedding);
}

export function getEmbedding(photoUri: string): number[] | undefined {
  return cache.get(photoUri);
}