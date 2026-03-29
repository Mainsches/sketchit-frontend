export type GenerateSketchPayload = {
  imageBase64?: string;
  imageUri?: string;
  category: string;
  style: string;
  material: string;
  qualityMode?: 'fast' | 'balanced' | 'best';
};

export type GenerateSketchResponse = {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  jobId?: string;
  error?: string;
};

const API_BASE_URL = 'https://your-backend.example.com';

export async function generateSketchConcept(
  payload: GenerateSketchPayload
): Promise<GenerateSketchResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Request failed with status ${response.status}`,
      };
    }

    const data = (await response.json()) as GenerateSketchResponse;
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}