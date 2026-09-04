// Gemini-backed progression analysis. The @google/genai SDK is imported
// dynamically so it lands in a lazy chunk and only loads when the user
// actually asks for an analysis.

export interface AnalyzeParams {
  root: string;
  scaleType: string;
  style: string;
  chordNames: string[];
}

export const buildPrompt = ({ root, scaleType, style, chordNames }: AnalyzeParams): string =>
  `Analyze this chord progression in the key of ${root} ${scaleType} for an intermediate guitar student.
      Progression: ${chordNames.join(' -> ')}.
      Musical Style: ${style}.
      Explain the functional harmony and voice leading. Brief & concise.`;

export const analyzeProgression = async (params: AnalyzeParams): Promise<string> => {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildPrompt(params),
  });
  return response.text || 'No feedback generated.';
};
