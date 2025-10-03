import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: 'AIzaSyByQxVTIWDO069hE7AgPBocZzvTq7gW9SI',
});

export async function askGemini(prompt) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error('Error en Gemini:', error);
    return `Error al generar respuesta: ${error.message}`;
  }
}
