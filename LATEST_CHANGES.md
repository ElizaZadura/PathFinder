# Latest Changes

## 🚀 Update: Cloud Database & Smart Tools

### Supabase Cloud Integration
- **Cloud Sync**: Connect to a **Supabase** backend to sync your **Master Career Profile** across devices.
- **Application Database**: Added a "Save to Database" option in the Export menu. This logs specific job applications (Company, Position, Salary, Status, CV text, etc.) directly to a `job_applications` table.
- **Settings Panel**: New configuration modal (top-right gear icon) to manage API keys and database connections.

### Smart Job Fetching
- **Arbetsförmedlingen API**: Specific support for `arbetsformedlingen.se` URLs. The app now detects these links and queries their public API directly for clean, structured job descriptions, bypassing complex HTML scraping.
- **Enhanced Fallback**: Improved generic URL extraction for other job boards using Gemini 2.5 Pro.

### New AI Capabilities
- **Job Insights Panel**: Ask Gemini free-form questions about the role (e.g., "What are my weak points?", "Likely interview questions?").
- **App Q&A Helper**: Generate short, punchy answers for specific application form questions (e.g., "Describe a challenge you overcame").
- **Cover Letter Refinement**: Added the ability to refine generated cover letters with natural language commands, matching the CV refinement capability.

### UI & Quality of Life
- **Unified Export Menu**: Consolidated CSV, JSON, ZIP, and Database actions into a single dropdown.
- **Toast Notifications**: Added smooth feedback popups for actions like copying text or saving data.

---

## Previous Update: Profile Builder

### New Feature: Profile Builder
- **Multi-File Upload**: You can now upload multiple documents at once (PDF, DOCX, TXT, MD).
- **Master Profile Generation**: Gemini now consolidates your uploaded documents into a single, structured "Master Career Profile". This serves as a comprehensive database of your entire history (projects, skills, experience) to ensure no detail is lost when tailoring CVs.
- **Local Storage**: The Master Profile is automatically saved to your browser's local storage so it persists between sessions.

### Updates to CV Tailor
- **"Load Master" Button**: Added a quick button to load your generated Master Profile directly into the CV input area.
- **Enhanced File Loading**: Refactored file loading logic to support PDF parsing (via PDF.js) alongside DOCX (via Mammoth.js) and text files.
- **UI Improvements**: Added a "Profile Builder" tab to the main navigation.

### Technical Improvements
- **PDF.js Integration**: Added support for parsing text from PDF files directly in the browser without needing a backend.
- **Centralized File Helpers**: Created `utils/fileHelpers.ts` to manage file extraction logic centrally.
- **Iconography**: Added new icons (`FileStackIcon`, `UserIcon`) for the new interface elements.