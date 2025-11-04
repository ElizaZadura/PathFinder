# Gemini CV & Conversation Assistant

A web application that leverages the Gemini API to help you tailor your CV for specific job applications and practice your interview skills with a real-time voice assistant.

## Features

-   **CV Tailoring**: Automatically rewrites your CV to highlight the most relevant skills and experience for a given job posting.
-   **Cover Letter Generation**: Creates a professional and compelling cover letter based on your CV and the job description.
-   **Interactive CV Refinement**: Allows you to provide natural language feedback (e.g., "make the summary more concise") to iteratively improve your tailored CV.
-   **ATS Friendliness Analysis**: Scans your tailored CV against the job posting to provide a detailed Applicant Tracking System (ATS) compliance report, including keyword matching and structural feedback.
-   **Job Data Export**: Extracts key details (Position, Company, Salary, etc.) from the job posting and your CV into a CSV file, ready to be imported into your job application tracking software.
-   **Live Conversation**: Engage in a real-time, voice-based conversation with Gemini. Perfect for interview practice or general queries.

## How to Run/Build

To run this project locally, you'll need to have Node.js and a package manager like npm installed.

1.  **Clone the repository** (if you have access to it).

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your API Key:**
    The application requires a Gemini API key. You will need to set it up as an environment variable named `API_KEY`. Create a `.env` file in the project's root directory and add the following line:
    ```
    API_KEY=YOUR_GEMINI_API_KEY
    ```
    You can obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:5173`.

5.  **Build for production:**
    ```bash
    npm run build
    ```
    This command will generate a `dist` folder with the production-ready files.


## How to Use

### CV Tailor

1.  Navigate to the **CV Tailor** tab.
2.  Paste your current CV into the "Your CV" text area, or use the "Load from File" button to upload a `.docx` or `.txt` file. Your CV is automatically saved in your browser for future visits.
3.  Provide the job description by either pasting a URL and clicking "Fetch" or pasting the text directly.
4.  Select your desired output language.
5.  Click the **Tailor My CV** button. Your new, tailored CV will appear below, along with extracted keywords and a summary of changes.
6.  Click **Generate Cover Letter** to create a cover letter based on the provided documents.
7.  Use the **Refine CV** section to make further adjustments by typing in your requests.
8.  Click **Analyze ATS Friendliness** to get a detailed report on how well your tailored CV is optimized for applicant tracking systems.
9.  Click **Export Job Data** to download a CSV file with key application details for your personal tracking.
10. You can save your tailored CV or cover letter as a `.txt` or `.pdf` file using the "Save As..." buttons.

### Live Chat

1.  Navigate to the **Live Chat** tab.
2.  Click the microphone icon to start the conversation. You will need to grant microphone permissions.
3.  Start speaking. The conversation will be transcribed in real-time.
4.  Click the stop icon to end the session.
