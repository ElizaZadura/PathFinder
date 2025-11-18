
export interface TranscriptionTurn {
  speaker: 'user' | 'model';
  text: string;
}

export interface ATSReport {
  layoutSafety: {
    issues: string[];
  };
  structure: {
    missingSections: string[];
    experienceCheck: string;
  };
  keywordMatch: {
    jobKeywords: { keyword: string; recommended: boolean }[];
    cvKeywords: { keyword: string; count: number }[];
    alignmentScore: number;
  };
  formatting: {
    issues: string[];
  };
  metadata: {
    suggestedFilename: string;
    contactInfoWarning: string;
  };
  readabilityScore: number;
}

export interface JobData {
    position: string;
    companyName: string;
    companyDescription: string;
    salary: string;
    contact: string;
    source: string;
    suggestedCvFilename: string;
    nextAction: string;
    notes: string;
}
