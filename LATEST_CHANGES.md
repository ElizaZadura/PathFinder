# Latest Changes - Profile Builder Update

## New Feature: Profile Builder
- **Multi-File Upload**: You can now upload multiple documents at once (PDF, DOCX, TXT, MD).
- **Master Profile Generation**: Gemini now consolidates your uploaded documents into a single, structured "Master Career Profile". This serves as a comprehensive database of your entire history (projects, skills, experience) to ensure no detail is lost when tailoring CVs.
- **Local Storage**: The Master Profile is automatically saved to your browser's local storage so it persists between sessions.

## Updates to CV Tailor
- **"Load Master" Button**: Added a quick button to load your generated Master Profile directly into the CV input area.
- **Enhanced File Loading**: Refactored file loading logic to support PDF parsing (via PDF.js) alongside DOCX (via Mammoth.js) and text files.
- **UI Improvements**: Added a "Profile Builder" tab to the main navigation.

## Technical Improvements
- **PDF.js Integration**: Added support for parsing text from PDF files directly in the browser without needing a backend.
- **Centralized File Helpers**: Created `utils/fileHelpers.ts` to manage file extraction logic centrally.
- **Iconography**: Added new icons (`FileStackIcon`, `UserIcon`) for the new interface elements.
