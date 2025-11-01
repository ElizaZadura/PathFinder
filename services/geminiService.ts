import { GoogleGenAI, Type, LiveSession, LiveServerMessage, Modality } from "@google/genai";

// Ensure the API key is available, but do not hardcode it.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

export async function getJobDescriptionFromUrl(url: string): Promise<string> {
  try {
    if (!url.startsWith('http')) {
      throw new Error("Invalid URL provided.");
    }
    // 1. Fetch HTML content via CORS proxy
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL content. Status: ${response.status}. The website may be blocking requests.`);
    }
    const html = await response.text();

    if (!html) {
        throw new Error("Fetched content is empty. The page might be client-side rendered and not accessible this way.");
    }

    // 2. Use Gemini to extract the job description from the HTML
    const prompt = `
      From the following raw HTML of a webpage, please extract only the text content of the main job description.
      Clean it up by removing all HTML tags, scripts, styles, navigation bars, headers, footers, and any other irrelevant content like ads or sidebars.
      If the page does not appear to contain a job description, respond with "ERROR: No job description found on this page.".
      Return only the clean, plain text of the job description itself.

      **Raw HTML (first 250kb):**
      ${html.substring(0, 250000)}
    `;

    const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    const resultText = geminiResponse.text;
    if (resultText.startsWith("ERROR:")) {
        throw new Error(resultText);
    }
    
    return resultText;
  } catch (error) {
    console.error("Error getting job description from URL:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to process the URL: ${error.message}`);
    }
    throw new Error("An unknown error occurred while processing the job description URL.");
  }
}

export async function getTailoredCV(cv: string, jobPosting: string, language: string): Promise<string> {
  try {
    const prompt = `
      Based on the following resume and job description, please rewrite the resume to highlight the most relevant skills and experiences.
      The goal is to tailor the resume for this specific job application. 
      Maintain a professional tone and structure.
      
      IMPORTANT: The final output must be written in **${language}**.

      Return only the rewritten resume text, without any additional commentary.

      **Original Resume:**
      ${cv}

      **Job Description:**
      ${jobPosting}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt
    });
    
    return response.text;
  } catch (error) {
    console.error("Error tailoring CV:", error);
    throw new Error("Failed to get tailored CV from Gemini API.");
  }
}

export async function extractKeywords(jobPosting: string): Promise<string[]> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Extract the top 5-7 most important technical skills, soft skills, and qualifications from this job posting. Present them as a list of keywords.

            Job Posting:
            ${jobPosting}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        keywords: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING
                            }
                        }
                    }
                }
            }
        });
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse.keywords || [];
    } catch (error) {
        console.error("Error extracting keywords:", error);
        return [];
    }
}


export function connectToLiveSession(callbacks: {
    onOpen: () => void;
    onMessage: (message: LiveServerMessage) => Promise<void>;
    onError: (e: ErrorEvent) => void;
    onClose: (e: CloseEvent) => void;
}): Promise<LiveSession> {
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: callbacks.onOpen,
      onmessage: callbacks.onMessage,
      onerror: callbacks.onError,
      onclose: callbacks.onClose,
    },
    config: {
      // FIX: Use Modality.AUDIO enum instead of string 'AUDIO' per Gemini API guidelines.
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      systemInstruction: 'You are a friendly, helpful assistant. Keep your responses concise and conversational.',
    },
  });
}