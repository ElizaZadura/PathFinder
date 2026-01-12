import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { ATSReport, JobData } from '../types';

// Ensure the API key is available, but do not hardcode it.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean up text (e.g. replace literal \n with actual newlines)
function cleanText(text: string | undefined): string {
    if (!text) return "";
    return text.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
}

export async function getJobDescriptionFromUrl(url: string): Promise<string> {
  // Special handling for arbetsformedlingen.se, which uses a public API.
  const arbetsformedlingenRegex = /arbetsformedlingen\.se\/platsbanken\/annonser\/(\d+)/;
  const match = url.match(arbetsformedlingenRegex);

  if (match && match[1]) {
    const jobId = match[1];
    const apiUrl = `https://platsbanken-api.arbetsformedlingen.se/jobs/v1/job/${jobId}`;
    try {
      console.log(`Fetching from Arbetsförmedlingen API: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'INT_SYS': 'platsbanken_web_beta',
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      let description = "";
      if (data?.description?.text) {
          description = data.description.text;
      } else if (data?.description?.textFormatted) {
           const tempEl = document.createElement("div");
           tempEl.innerHTML = data.description.textFormatted;
           description = tempEl.innerText || tempEl.textContent || "";
      } else if (data?.body?.text) {
           const val = data.body.text;
           if (val && (val.includes('<p>') || val.includes('<br'))) {
               const tempEl = document.createElement("div");
               tempEl.innerHTML = val;
               description = tempEl.innerText || tempEl.textContent || "";
           } else {
               description = val;
           }
      }
      
      if (description && description.trim().length > 0) {
        return cleanText(description);
      } 

      try {
        const jsonString = JSON.stringify(data).slice(0, 30000);
        const extractPrompt = `
            Analyze the following JSON response from a job board API.
            Extract the main job description text. 
            Return ONLY the plain text of the job description.
            
            JSON Data:
            ${jsonString}
        `;

        // Updated to gemini-3-flash-preview for general text extraction
        const extractResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: extractPrompt,
        });
        
        const extractedText = (extractResponse.text || "").trim();
        if (extractedText && extractedText.length > 50) {
            return cleanText(extractedText);
        }
      } catch (fallbackError) {
        console.error("Gemini fallback extraction failed:", fallbackError);
      }

      throw new Error("Job description not found in the Arbetsförmedlingen API response.");

    } catch (apiError) {
      console.error("Error fetching from Arbetsförmedlingen API:", apiError);
      throw new Error("Failed to fetch job description from the Arbetsförmedlingen API. Please try pasting the text manually.");
    }
  }

  try {
    if (!url.startsWith('http')) {
      throw new Error("Invalid URL provided.");
    }
    
    const prompt = `
      Your task is to act as a simple but precise text extractor. You will be given a single URL.
      Your ONLY source of information MUST be the content at that exact URL: ${url}
      Extract and return ONLY the clean, plain text of that specific job description.
      If you cannot access the exact URL, respond with: "ERROR: Could not retrieve a job description from the provided URL."
    `;

    // Updated to gemini-3-pro-preview for complex grounding tasks
    const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
    });
    
    const resultText = (geminiResponse.text || "").trim();
    
    if (resultText.startsWith("ERROR:") || !resultText) {
        const modelError = resultText.replace("ERROR: ", "");
        throw new Error(`${modelError || 'Could not retrieve a job description from the provided URL.'}`);
    }

    return cleanText(resultText);
  } catch (error) {
    console.error("Error getting job description from URL:", error);
    if (error instanceof Error) {
        if (error.message.includes('Could not retrieve a job description')) throw error;
        throw new Error(`Failed to process the URL: ${error.message}`);
    }
    throw new Error("An unknown error occurred while processing the job description URL.");
  }
}

export async function generateMasterProfile(docs: string[]): Promise<string> {
  try {
    const combinedDocs = docs.map((doc, index) => `--- DOCUMENT ${index + 1} ---\n${doc}`).join('\n\n');
    const prompt = `Create a comprehensive Master Career Profile in Markdown from these documents: ${combinedDocs}`;
    // Updated to gemini-3-pro-preview for complex profile synthesis
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return cleanText(response.text);
  } catch (error) {
    throw new Error("Failed to generate Master Profile.");
  }
}

export async function extendMasterProfile(currentProfile: string, newDocs: string[]): Promise<string> {
  try {
    const combinedDocs = newDocs.map((doc, index) => `--- NEW DOCUMENT ${index + 1} ---\n${doc}`).join('\n\n');

    const prompt = `
      You are an expert Career Architect.
      
      **Goal:** Update an existing "Master Career Profile" by integrating information from new documents.
      
      **Existing Master Profile:**
      ${currentProfile}

      **New Documents to Integrate:**
      ${combinedDocs}

      **Instructions:**
      1. Analyze the New Documents.
      2. Integrate any *new* experiences, skills, projects, education, or certifications into the structure of the Existing Master Profile.
      3. **De-duplicate:** If an experience in the New Documents already exists in the Master Profile, check if the new one provides more detail. If so, enhance the existing entry. Do not create duplicate entries for the same role/project.
      4. **Structure:** Maintain the existing Markdown structure (Summary, Experience, Skills, etc.).
      5. **Chronology:** Ensure the "Professional Experience" section remains sorted chronologically (newest first).
      6. Return the **complete, updated** Master Profile in Markdown.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });

    return cleanText(response.text);
  } catch (error) {
    console.error("Error extending master profile:", error);
    throw new Error("Failed to update Master Profile from Gemini API.");
  }
}

export async function getTailoredCV(cv: string, jobPosting: string, language: string): Promise<{ tailoredCv: string; changesSummary: string; suggestedFilename: string; }> {
  try {
    const prompt = `
      You are an expert Executive Resume Writer.

      **CONTEXT:**
      - **Source Material:** The provided "Current CV/Profile" is a **Master Profile**. It is a comprehensive database containing the candidate's *entire* career history, every project, and every skill. It is intentionally too long.
      - **Target:** The "Job Description" is the specific role being applied for.

      **YOUR TASK:**
      Create a **targeted, high-impact CV** derived from the Master Profile that is laser-focused on the Job Description.

      **STRICT CONSTRAINTS:**
      1. **LENGTH LIMIT:** The output CV must be **MAXIMUM 2 PAGES** long. You MUST cut, summarize, or omit information to meet this limit.
      2. **CURATION:** Do NOT simply reformat the Master Profile. You must aggressively **FILTER** content.
         - Include ONLY experience and skills relevant to *this specific job*.
         - For older or irrelevant roles, reduce them to just Title, Company, and Dates, or omit them entirely if they add no value.
      3. **ACCURACY:** You must maintain the exact dates and company names from the source. Do NOT hallucinate experiences.
      4. **LANGUAGE:** Write the output in **${language}**.
      5. **FORMAT:** Standard Markdown CV format.

      **INPUT DATA:**
      
      --- MASTER PROFILE (SOURCE) ---
      ${cv}

      --- JOB DESCRIPTION (TARGET) ---
      ${jobPosting}
    `;

    // Updated to gemini-3-pro-preview for precision in tailoring
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tailoredCv: { type: Type.STRING, description: "The tailored markdown CV, max 2 pages." },
                    changesSummary: { type: Type.STRING, description: "A bulleted list explaining what was kept, what was cut, and why, to fit the 2-page limit." },
                    suggestedFilename: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    throw new Error("Failed to get tailored CV.");
  }
}

export async function generateCoverLetter(cv: string, jobPosting: string, language: string): Promise<string> {
  try {
    const prompt = `Write a cover letter in ${language} for this job. Resume: ${cv} Job: ${jobPosting}`;
    // Updated to gemini-3-pro-preview
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: { coverLetter: { type: Type.STRING } }
            }
        }
    });
    return JSON.parse(response.text || "{}").coverLetter || "";
  } catch (error) {
    throw new Error("Failed to generate cover letter.");
  }
}

export async function refineCoverLetter(cv: string, jobPosting: string, currentCoverLetter: string, refinementRequest: string, language: string): Promise<string> {
    try {
        const prompt = `Refine this cover letter: ${currentCoverLetter}. Request: ${refinementRequest}. Language: ${language}`;
        // Updated to gemini-3-pro-preview
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { coverLetter: { type: Type.STRING } }
                }
            }
        });
        return JSON.parse(response.text || "{}").coverLetter || "";
    } catch (error) {
        throw new Error("Failed to refine cover letter.");
    }
}

export async function refineCV(cv: string, jobPosting: string, currentTailoredCv: string, refinementRequest: string, language: string): Promise<{ tailoredCv: string; changesSummary: string; }> {
    try {
        const prompt = `Refine this CV: ${currentTailoredCv}. Request: ${refinementRequest}. Language: ${language}`;
        // Updated to gemini-3-pro-preview
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { tailoredCv: { type: Type.STRING }, changesSummary: { type: Type.STRING } }
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (error) {
        throw new Error("Failed to refine CV.");
    }
}

export async function extractKeywords(jobPosting: string): Promise<string[]> {
    try {
        // Updated to gemini-3-flash-preview
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Extract top keywords from: ${jobPosting}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { keywords: { type: Type.ARRAY, items: { type: Type.STRING } } }
                }
            }
        });
        return JSON.parse(response.text || "{}").keywords || [];
    } catch (error) {
        return [];
    }
}

export async function checkATSCompliance(cv: string, jobPosting: string): Promise<ATSReport> {
  try {
    const prompt = `Analyze ATS compliance for this CV against the job description. Provide report in JSON. CV: ${cv} Job: ${jobPosting}`;
    // Updated to gemini-3-pro-preview and fixed 'alignmentScore' property reference in required array
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    layoutSafety: { type: Type.OBJECT, properties: { issues: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['issues'] },
                    structure: { type: Type.OBJECT, properties: { missingSections: { type: Type.ARRAY, items: { type: Type.STRING } }, experienceCheck: { type: Type.STRING } }, required: ['missingSections', 'experienceCheck'] },
                    keywordMatch: { type: Type.OBJECT, properties: { jobKeywords: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { keyword: { type: Type.STRING }, recommended: { type: Type.BOOLEAN } }, required: ['keyword', 'recommended'] } }, cvKeywords: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { keyword: { type: Type.STRING }, count: { type: Type.INTEGER } }, required: ['keyword', 'count'] } }, alignmentScore: { type: Type.INTEGER } }, required: ['jobKeywords', 'cvKeywords', 'alignmentScore'] },
                    formatting: { type: Type.OBJECT, properties: { issues: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['issues'] },
                    metadata: { type: Type.OBJECT, properties: { suggestedFilename: { type: Type.STRING }, contactInfoWarning: { type: Type.STRING } }, required: ['suggestedFilename', 'contactInfoWarning'] },
                    readabilityScore: { type: Type.INTEGER }
                },
                required: ['layoutSafety', 'structure', 'keywordMatch', 'formatting', 'metadata', 'readabilityScore']
            }
        }
    });
    return JSON.parse(response.text || "{}") as ATSReport;
  } catch (error) {
    throw new Error("Failed to check ATS compliance.");
  }
}

export async function extractJobDataForCSV(cv: string, jobPosting: string): Promise<JobData> {
  try {
    const prompt = `
      Extract job application details from the provided text.
      - For 'nextAction', you MUST return exactly the string "Follow up". Do not add any extra text like "in one week".
      - For 'position', extract the exact job title.
      - For 'companyName', extract the company that is hiring.
      - For 'companyDescription', provide a 1-2 sentence summary.
      - For 'salary', return "Empty" if not found.
      - For 'contact', return name or email, or "Empty".
      - For 'suggestedCvFilename', create a standard filename like 'FirstName-LastName-Role-CV.pdf'.
      - For 'notes', write a one-sentence summary.
      - For 'referenceUrl', extract the posting URL if found, else "Empty".

      CV: ${cv}
      Job: ${jobPosting}
    `;

    // Updated to gemini-3-pro-preview
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            position: { type: Type.STRING },
            companyName: { type: Type.STRING },
            companyDescription: { type: Type.STRING },
            salary: { type: Type.STRING },
            contact: { type: Type.STRING },
            suggestedCvFilename: { type: Type.STRING },
            nextAction: { type: Type.STRING, description: 'MUST be "Follow up".' },
            notes: { type: Type.STRING },
            referenceUrl: { type: Type.STRING },
          },
          required: ['position', 'companyName', 'companyDescription', 'salary', 'contact', 'suggestedCvFilename', 'nextAction', 'notes', 'referenceUrl'],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result as JobData;
  } catch (error) {
    throw new Error("Failed to extract job data.");
  }
}

export async function generateJobInsights(cv: string, jobPosting: string, query: string): Promise<string> {
  try {
    const prompt = `Consultant role. Question: ${query}. CV: ${cv}. Job: ${jobPosting}`;
    // Updated to gemini-3-pro-preview
    const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
    return cleanText(response.text);
  } catch (error) {
    throw new Error("Failed to generate insights.");
  }
}

export async function generateApplicationAnswer(cv: string, jobPosting: string, question: string): Promise<string> {
  try {
    const prompt = `Write a short answer for: ${question}. Context: CV: ${cv} Job: ${jobPosting}. Rules: Natural tone, 1st person, 2-5 sentences.`;
    // Updated to gemini-3-flash-preview
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return cleanText(response.text);
  } catch (error) {
    throw new Error("Failed to generate answer.");
  }
}

export function connectToLiveSession(callbacks: {
    onOpen: () => void;
    onMessage: (message: LiveServerMessage) => Promise<void>;
    onError: (e: ErrorEvent) => void;
    onClose: (e: CloseEvent) => void;
}) {
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: callbacks.onOpen,
      onmessage: callbacks.onMessage,
      onerror: callbacks.onError,
      onclose: callbacks.onClose,
    },
    config: {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      systemInstruction: 'You are a friendly assistant.',
    },
  });
}