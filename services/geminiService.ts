// FIX: Removed import of non-exported type 'LiveSession'.
import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { ATSReport } from '../types';

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

export async function getTailoredCV(cv: string, jobPosting: string, language: string): Promise<{ tailoredCv: string; changesSummary: string; }> {
  try {
    const prompt = `
      Based on the following resume and job description, please rewrite the resume to highlight the most relevant skills and experiences for this specific job application.
      Maintain a professional tone and structure. The final rewritten resume must be in **${language}**.

      After rewriting the resume, provide a brief summary of the key changes you made. Present this summary as a markdown list of bullet points.

      **Original Resume:**
      ${cv}

      **Job Description:**
      ${jobPosting}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tailoredCv: {
                        type: Type.STRING,
                        description: "The full, rewritten and tailored resume text."
                    },
                    changesSummary: {
                        type: Type.STRING,
                        description: "A summary of key changes made to the resume, formatted as a markdown list."
                    }
                }
            }
        }
    });
    
    const result = JSON.parse(response.text);
    return result;
  } catch (error) {
    console.error("Error tailoring CV:", error);
    throw new Error("Failed to get tailored CV from Gemini API.");
  }
}

export async function refineCV(cv: string, jobPosting: string, currentTailoredCv: string, refinementRequest: string, language: string): Promise<{ tailoredCv: string; changesSummary: string; }> {
    try {
        const prompt = `
        You are an expert resume editor. Your task is to refine an already tailored resume based on a user's specific request.

        You will be given the original resume, the job description it was tailored for, the current version of the tailored resume, and a refinement request from the user.

        Your goal is to apply the changes from the refinement request to the "Current Tailored Resume". Do not start from scratch from the original resume. The output must be in **${language}**.

        After refining the resume, provide a brief summary of the specific changes you just made based on the user's request. Present this summary as a markdown list of bullet points.

        **Original Resume:**
        ${cv}

        **Job Description:**
        ${jobPosting}

        **Current Tailored Resume:**
        ${currentTailoredCv}

        **User's Refinement Request:**
        ${refinementRequest}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tailoredCv: {
                            type: Type.STRING,
                            description: "The full, rewritten and tailored resume text reflecting the user's refinement request."
                        },
                        changesSummary: {
                            type: Type.STRING,
                            description: "A summary of the specific changes just made based on the user's request, formatted as a markdown list."
                        }
                    }
                }
            }
        });
        
        const result = JSON.parse(response.text);
        return result;
    } catch (error) {
        console.error("Error refining CV:", error);
        throw new Error("Failed to refine CV using the Gemini API.");
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

export async function checkATSCompliance(cv: string, jobPosting: string): Promise<ATSReport> {
  try {
    const prompt = `
      You are an expert ATS (Applicant Tracking System) compliance checker for resumes. Your task is to analyze a given resume against a job description and provide a detailed, structured report in JSON format.

      Evaluate the resume based on the following criteria and provide your findings strictly following the JSON schema provided.

      **Criteria:**

      1.  **File / Layout Safety**:
          *   From the text, infer if the original document might contain ATS-unfriendly elements like tables, columns, icons, images, or special graphical bullets. List any potential issues. If none, the list should be empty.

      2.  **Structure**:
          *   Check for the presence of these standard sections: "Summary" (or "Objective"), "Experience" (or "Work History"), "Education", and "Skills". List any that are missing.
          *   Briefly assess if the "Experience" section entries seem to include a company, title, dates, and descriptive bullet points. Provide a one-sentence summary of this check.

      3.  **Keyword Match**:
          *   Extract the top 10 most important skills, technologies, and qualifications from the job description. For each, indicate if it's a "recommended" keyword to include.
          *   Count the occurrences of each of these top 10 keywords in the resume. Only list keywords that are actually found.
          *   Provide an overall "Job-Keyword Alignment" score from 0 (no match) to 5 (excellent match), as a whole number.

      4.  **Formatting Consistency**:
          *   Based on the text, infer potential formatting inconsistencies. Check for clues of multiple font styles or bullet point styles.
          *   Check if date formats (e.g., for jobs and education) are consistent (e.g., all "MMM YYYY – MMM YYYY" or "YYYY–YYYY"). List any detected inconsistencies.

      5.  **Metadata Readiness**:
          *   Suggest an ideal, ATS-friendly filename based on a common pattern like "FirstName-LastName-Role-CV.pdf". You'll have to infer the name and role from the resume. If you cannot infer a name, use "Candidate".
          *   Analyze the likely placement of contact information (name, email, phone). Warn if it seems to be in a header or footer, as ATS can sometimes miss this. Provide a one-sentence assessment.

      6.  **Final Rating**:
          *   Provide an overall "ATS-Readability" score from 0 (very poor) to 5 (excellent), as a whole number, considering layout, structure, and formatting.

      **Resume Text:**
      ${cv}

      **Job Description Text:**
      ${jobPosting}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    layoutSafety: {
                        type: Type.OBJECT,
                        properties: {
                            issues: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['issues']
                    },
                    structure: {
                        type: Type.OBJECT,
                        properties: {
                            missingSections: { type: Type.ARRAY, items: { type: Type.STRING } },
                            experienceCheck: { type: Type.STRING }
                        },
                        required: ['missingSections', 'experienceCheck']
                    },
                    keywordMatch: {
                        type: Type.OBJECT,
                        properties: {
                            jobKeywords: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        keyword: { type: Type.STRING },
                                        recommended: { type: Type.BOOLEAN }
                                    },
                                    required: ['keyword', 'recommended']
                                }
                            },
                            cvKeywords: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        keyword: { type: Type.STRING },
                                        count: { type: Type.INTEGER }
                                    },
                                    required: ['keyword', 'count']
                                }
                            },
                            alignmentScore: { type: Type.INTEGER }
                        },
                         required: ['jobKeywords', 'cvKeywords', 'alignmentScore']
                    },
                    formatting: {
                        type: Type.OBJECT,
                        properties: {
                            issues: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['issues']
                    },
                    metadata: {
                        type: Type.OBJECT,
                        properties: {
                            suggestedFilename: { type: Type.STRING },
                            contactInfoWarning: { type: Type.STRING }
                        },
                        required: ['suggestedFilename', 'contactInfoWarning']
                    },
                    readabilityScore: { type: Type.INTEGER }
                },
                required: ['layoutSafety', 'structure', 'keywordMatch', 'formatting', 'metadata', 'readabilityScore']
            }
        }
    });
    
    const result = JSON.parse(response.text);
    return result as ATSReport;
  } catch (error) {
    console.error("Error checking ATS compliance:", error);
    throw new Error("Failed to check ATS compliance using the Gemini API.");
  }
}


// FIX: Removed explicit return type 'Promise<LiveSession>' to allow type inference, as 'LiveSession' is not an exported type.
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
      // FIX: Use Modality.AUDIO enum instead of string 'AUDIO' per Gemini API guidelines.
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      systemInstruction: 'You are a friendly, helpful assistant. Keep your responses concise and conversational.',
    },
  });
}
