import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { ATSReport, JobData } from '../types';

// Ensure the API key is available, but do not hardcode it.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean up text (e.g. replace literal \n with actual newlines)
function cleanText(text: string): string {
    if (!text) return "";
    return text.replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
}

export async function getJobDescriptionFromUrl(url: string): Promise<string> {
  // Special handling for arbetsformedlingen.se, which uses a public API.
  // This is more reliable than using the general-purpose Gemini fetcher.
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
      
      // Attempt to extract description from various known fields
      // API v1 usually has description.text (plain) or description.textFormatted (HTML).
      let description = "";
      if (data?.description?.text) {
          description = data.description.text;
      } else if (data?.description?.textFormatted) {
           // Convert HTML to text using browser DOM
           const tempEl = document.createElement("div");
           tempEl.innerHTML = data.description.textFormatted;
           description = tempEl.innerText || tempEl.textContent || "";
      } else if (data?.body?.text) {
           // Legacy path: try to parse as HTML if it looks like it, otherwise treat as text
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

      // Fallback: If structural extraction failed, ask Gemini to extract it from the JSON.
      // This handles cases where the API structure might have changed or is unexpected.
      try {
        console.warn("Standard extraction failed, attempting to parse API response with Gemini.");
        const jsonString = JSON.stringify(data).slice(0, 30000); // Limit size to avoid excessive token usage

        const extractPrompt = `
            Analyze the following JSON response from a job board API.
            Extract the main job description text. 
            Return ONLY the plain text of the job description.
            
            JSON Data:
            ${jsonString}
        `;

        const extractResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: extractPrompt,
        });
        
        const extractedText = extractResponse.text.trim();
        if (extractedText && extractedText.length > 50) {
            return cleanText(extractedText);
        }
      } catch (fallbackError) {
        console.error("Gemini fallback extraction failed:", fallbackError);
      }

      // If both manual extraction and Gemini fallback fail
      console.error("Arbetsförmedlingen API response structure unknown:", data);
      throw new Error("Job description not found in the Arbetsförmedlingen API response.");

    } catch (apiError) {
      console.error("Error fetching from Arbetsförmedlingen API:", apiError);
      throw new Error("Failed to fetch job description from the Arbetsförmedlingen API. Please try pasting the text manually.");
    }
  }

  // Fallback to Gemini for all other URLs
  try {
    if (!url.startsWith('http')) {
      throw new Error("Invalid URL provided.");
    }
    
    const prompt = `
      Your task is to act as a simple but precise text extractor. You will be given a single URL.

      Your ONLY source of information MUST be the content at that exact URL: ${url}

      Do NOT use a general web search or information from any other source. Access the URL provided and identify the main content of the job description.

      Extract and return ONLY the clean, plain text of that specific job description. Include all details like responsibilities, qualifications, and company information. Exclude all surrounding website-related text like navigation menus, headers, footers, ads, and "related jobs" links.

      If you cannot access the exact URL, or if there is no job description at that URL, you MUST respond with the exact phrase: "ERROR: Could not retrieve a job description from the provided URL."
    `;

    const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
    });
    
    const resultText = geminiResponse.text.trim();
    
    if (resultText.startsWith("ERROR:") || !resultText) {
        const modelError = resultText.replace("ERROR: ", "");
        throw new Error(`${modelError || 'Could not retrieve a job description from the provided URL.'} This can happen with complex websites (like LinkedIn) or private job postings. Please try copying and pasting the text manually.`);
    }

    return cleanText(resultText);
  } catch (error) {
    console.error("Error getting job description from URL:", error);
    if (error instanceof Error) {
        // Avoid re-wrapping the error message if it's already the one we want.
        if (error.message.includes('Could not retrieve a job description')) {
            throw error;
        }
        throw new Error(`Failed to process the URL: ${error.message}`);
    }
    throw new Error("An unknown error occurred while processing the job description URL.");
  }
}

export async function generateMasterProfile(docs: string[]): Promise<string> {
  try {
    const combinedDocs = docs.map((doc, index) => `--- DOCUMENT ${index + 1} ---\n${doc}`).join('\n\n');

    const prompt = `
      You are an expert Career Architect. I have provided you with the text content from ${docs.length} different documents (Old CVs, Project Summaries, LinkedIn exports, etc.).

      **Your Task:**
      Analyze all these documents to create a single, comprehensive **Master Career Profile** in Markdown format.

      **Instructions:**
      1.  **Consolidate & De-duplicate:** Merge similar work experiences. If one document has more detail for a specific role (e.g., dates, bullets), use the most detailed version.
      2.  **Timeline:** Organize the "Professional Experience" section chronologically (newest first).
      3.  **Skills:** Aggregate all technical and soft skills into a structured "Skills" section (e.g., Languages, Frameworks, Tools).
      4.  **Projects:** Create a detailed "Projects" section. If a project is mentioned in multiple docs, combine the details.
      5.  **Education & Certifications:** List all distinct degrees and certifications.
      6.  **Formatting:** Use clear Markdown headings (#, ##, ###) and bullet points.
      7.  **Completeness:** Do not summarize briefly; we want a *comprehensive* database of the candidate's entire history to be used for future tailoring.

      **Input Documents:**
      ${combinedDocs}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });

    return cleanText(response.text);
  } catch (error) {
    console.error("Error generating master profile:", error);
    throw new Error("Failed to generate Master Profile from Gemini API.");
  }
}

export async function getTailoredCV(cv: string, jobPosting: string, language: string): Promise<{ tailoredCv: string; changesSummary: string; suggestedFilename: string; }> {
  try {
    const prompt = `
      Based on the following "Master Resume/Profile" and "Job Description", please write a specifically tailored resume for this job application.

      **Instructions:**
      1.  Select the most relevant experience from the Master Profile that matches the Job Description.
      2.  The final resume should be concise (max 2 pages) but impactful.
      3.  Maintain a professional tone.
      4.  Language: **${language}**.
      5.  **Strict Date Handling:** Do not alter dates. Repeat dates exactly as in the source CV, even if they appear inconsistent or unusual. Do NOT add words like '(ongoing)', '(present)', '(expected)', or '(future)' if they are not in the source. Do not infer, adjust, or normalize dates. If a date appears incorrect, copy it **verbatim**.

      After rewriting the resume, provide:
      1. A brief summary of the key changes/selections you made.
      2. A suggested ATS-compliant filename (e.g. "FirstName-LastName-JobTitle").

      **Master Profile / Original Resume:**
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
                    },
                    suggestedFilename: {
                        type: Type.STRING,
                        description: "A standard, professional filename (e.g., 'John_Doe_Software_Engineer'). Do NOT include the file extension."
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
      You are an expert career coach and professional writer. Based on the provided resume and job description, write a professional, concise, and compelling cover letter.

      **Crucial Language Instruction:**
      The cover letter must be written in **${language}**.
      **Do NOT translate** the resume content word-for-word.
      Instead, **think and compose directly in ${language}**.
      Use native-level phrasing, idioms, and professional etiquette appropriate for that specific language and culture.
      If writing in Swedish, specifically ensure you avoid "Swenglish" (English sentence structures or idioms translated literally). The text must flow naturally for a native speaker.

      **Content Requirements:**
      1. Briefly introduce the candidate and the role they are applying for.
      2. Highlight 2-3 key experiences or skills from the resume that directly align with the most important requirements in the job description.
      3. Express enthusiasm for the role and the company.
      4. End with a strong call to action (e.g., expressing eagerness for an interview).
      5. Keep the tone professional, confident, and culturally appropriate for a ${language} workplace.
      6. The entire cover letter should be around 3-4 paragraphs long.

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

export async function refineCoverLetter(cv: string, jobPosting: string, currentCoverLetter: string, refinementRequest: string, language: string): Promise<string> {
    try {
        const prompt = `
        You are an expert professional writer and career coach. Your task is to refine an existing cover letter based on a user's specific request.

        **Instructions:**
        1. Apply the changes from the "User's Refinement Request" to the "Current Cover Letter".
        2. The output must be in **${language}**.
        3. **Think in ${language}.** Do not translate from English. Maintain native-level fluency and professional tone. Avoid "Swenglish" if writing in Swedish.
        4. Keep the structure professional and standard.

        **Original Resume (for context):**
        ${cv}

        **Job Description (for context):**
        ${jobPosting}

        **Current Cover Letter:**
        ${currentCoverLetter}

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
                        coverLetter: {
                            type: Type.STRING,
                            description: "The full, refined cover letter text."
                        }
                    }
                }
            }
        });
        
        const result = JSON.parse(response.text);
        return result.coverLetter;
    } catch (error) {
        console.error("Error refining cover letter:", error);
        throw new Error("Failed to refine cover letter using the Gemini API.");
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
      - For 'companyDescription', provide a brief (1-2 sentences) summary of what the company does based on the text.
      - For 'salary', extract any mention of salary or compensation. If not found, return "Empty".
      - For 'contact', find a hiring manager's name or a contact email. If none, return "Empty".
      - For 'suggestedCvFilename', create a standard filename like 'FirstName-LastName-Role.pdf' based on the candidate's name from the CV.
      - For 'nextAction', suggest a simple follow-up action like "Follow up in one week".
      - For 'notes', write a very brief, one-sentence summary of the job's core responsibility.
      - For 'referenceUrl', extract the URL of the job posting if explicitly mentioned in the text. Return "Empty" if not found.

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
            companyDescription: { type: Type.STRING, description: 'A brief 1-2 sentence summary of what the company does.' },
            salary: { type: Type.STRING, description: 'The salary or salary range mentioned. Return "Empty" if not found.' },
            contact: { type: Type.STRING, description: 'The contact person or email mentioned. Return "Empty" if not found.' },
            suggestedCvFilename: { type: Type.STRING, description: 'A suggested filename for the CV, like "FirstName-LastName-Role-CV.pdf". Infer from the CV text.' },
            nextAction: { type: Type.STRING, description: 'A suggested next action, like "Follow up in one week".' },
            notes: { type: Type.STRING, description: 'A brief, one-sentence summary of the role.' },
            referenceUrl: { type: Type.STRING, description: 'The URL of the job posting if found in the text. Return "Empty" if not found.' },
          },
          required: ['position', 'companyName', 'companyDescription', 'salary', 'contact', 'suggestedCvFilename', 'nextAction', 'notes', 'referenceUrl'],
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

export async function generateJobInsights(cv: string, jobPosting: string, query: string): Promise<string> {
  try {
    const prompt = `
      You are an expert career consultant. Analyze the provided CV and Job Description to answer the user's specific question.

      **User Question:**
      ${query}

      **CV:**
      ${cv}

      **Job Description:**
      ${jobPosting}

      Provide a helpful, professional, and specific answer based strictly on the provided text.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
    });

    return cleanText(response.text);
  } catch (error) {
    console.error("Error generating job insights:", error);
    throw new Error("Failed to generate insights.");
  }
}

export async function generateApplicationAnswer(cv: string, jobPosting: string, question: string): Promise<string> {
  try {
    const prompt = `
      You are assisting a candidate in filling out a job application form.
      Using the provided CV/Profile and Job Description as context, write a short answer to the specific question asked by the employer.

      **Employer Question:**
      ${question}

      **Candidate CV/Profile:**
      ${cv}

      **Job Description:**
      ${jobPosting}

      **Rules:**
      - Length: 2–5 sentences maximum.
      - Truthfulness: Absolutely no fabricated skills, experience, or achievements. Stick to facts in the CV.
      - Formatting: Use strict plain ASCII characters only. No curly quotes (“”), no em-dashes (—), use standard hyphens (-).
      - Tone: Natural, human, and direct. Avoid "AI polish", buzzwords, or flowery language.
      - Perspective: Write in the first person ("I").
      - Strategy: Do not summarize the entire CV. Choose one strong, specific angle that fits the question best.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    const text = cleanText(response.text);
    // Extra safety: manually replace common smart quotes just in case
    return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-');
  } catch (error) {
    console.error("Error generating application answer:", error);
    throw new Error("Failed to generate answer.");
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