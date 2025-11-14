// FIX: Removed import of non-exported type 'LiveSession'.
import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { ATSReport, JobData } from '../types';

// Ensure the API key is available, but do not hardcode it.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getJobDescriptionFromUrl(url: string): Promise<string> {
  try {
    if (!url.startsWith('http')) {
      throw new Error("Invalid URL provided.");
    }
    
    const prompt = `
      You are an expert web scraper. Your task is to go to the following URL and extract the full job description.

      URL: ${url}

      **Instructions:**
      1. Access the URL directly.
      2. Find the main content area that contains the job description.
      3. Extract the complete text of the job description, including responsibilities, qualifications, etc.
      4. Clean the extracted text by removing all extraneous content like navigation menus, headers, footers, sidebars, and advertisements.
      5. Return ONLY the cleaned, plain text of the job description.

      **IMPORTANT:** If you cannot access the URL, if the page requires a login, or if you cannot find a job description, you MUST respond with the exact text: "ERROR: Could not retrieve a job description from the provided URL."
    `;

    const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    const resultText = geminiResponse.text.trim();
    if (resultText.startsWith("ERROR:")) {
        const modelError = resultText.replace("ERROR: ", "");
        throw new Error(`${modelError} This can happen with complex websites (like LinkedIn) or private job postings. Please try copying and pasting the text manually.`);
    }

    if (!resultText) {
      throw new Error("The model returned an empty description. The job posting might be inaccessible or no longer available. Please try pasting the text manually.");
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
      The final rewritten resume should be concise and ideally not exceed the length of two standard A4 pages.
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

export async function generateCoverLetter(cv: string, jobPosting: string, language: string): Promise<string> {
  try {
    const prompt = `
      You are an expert career coach. Based on the provided resume and job description, write a professional, concise, and compelling cover letter.

      The cover letter should:
      1. Be written in **${language}**.
      2. Be addressed appropriately (e.g., "Dear Hiring Manager," if no name is available).
      3. Briefly introduce the candidate and the role they are applying for.
      4. Highlight 2-3 key experiences or skills from the resume that directly align with the most important requirements in the job description.
      5. Express enthusiasm for the role and the company.
      6. End with a strong call to action (e.g., expressing eagerness for an interview).
      7. Keep the tone professional and confident.
      8. The entire cover letter should be around 3-4 paragraphs long.

      **Candidate's Resume:**
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
                    coverLetter: {
                        type: Type.STRING,
                        description: "The full text of the generated cover letter."
                    }
                }
            }
        }
    });
    
    const result = JSON.parse(response.text);
    return result.coverLetter;
  } catch (error) {
    console.error("Error generating cover letter:", error);
    throw new Error("Failed to generate cover letter from Gemini API.");
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

export async function extractJobDataForCSV(cv: string, jobPosting: string): Promise<JobData> {
  try {
    const prompt = `
      You are a meticulous data entry assistant. Your task is to analyze the provided CV and job description to extract specific information for a job application tracking system. Please populate the fields in the provided JSON schema.

      - For 'position', extract the exact job title.
      - For 'companyName', extract the company that is hiring.
      - For 'salary', extract any mention of salary or compensation. If not found, return "Empty".
      - For 'contact', find a hiring manager's name or a contact email. If none, return "Empty".
      - For 'source', identify the platform where the job was posted (e.g., LinkedIn, Indeed, Company Website). If you cannot determine it from the text, return "Empty".
      - For 'suggestedCvFilename', create a standard filename like 'FirstName-LastName-Role.pdf' based on the candidate's name from the CV.
      - For 'nextAction', suggest a simple follow-up action like "Follow up in one week".
      - For 'notes', write a very brief, one-sentence summary of the job's core responsibility.

      **CV Text:**
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
            position: { type: Type.STRING, description: 'The job title or position.' },
            companyName: { type: Type.STRING, description: 'The name of the company.' },
            salary: { type: Type.STRING, description: 'The salary or salary range mentioned. Return "Empty" if not found.' },
            contact: { type: Type.STRING, description: 'The contact person or email mentioned. Return "Empty" if not found.' },
            source: { type: Type.STRING, description: 'The source platform (e.g., LinkedIn, company website). Infer from the job posting text or URL context.' },
            suggestedCvFilename: { type: Type.STRING, description: 'A suggested filename for the CV, like "FirstName-LastName-Role-CV.pdf". Infer from the CV text.' },
            nextAction: { type: Type.STRING, description: 'A suggested next action, like "Follow up in one week".' },
            notes: { type: Type.STRING, description: 'A brief, one-sentence summary of the role.' },
          },
          required: ['position', 'companyName', 'salary', 'contact', 'source', 'suggestedCvFilename', 'nextAction', 'notes'],
        },
      },
    });

    const result = JSON.parse(response.text);
    return result as JobData;
  } catch (error) {
    console.error("Error extracting job data for CSV:", error);
    throw new Error("Failed to extract job data using the Gemini API.");
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