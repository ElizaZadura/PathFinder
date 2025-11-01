# Gemini CV & Conversation Assistant

A web application that leverages the Gemini API to help you tailor your CV for specific job applications and practice your interview skills with a real-time voice assistant.

## Features

-   **CV Tailoring**: Automatically rewrites your CV to highlight the most relevant skills and experience for a given job posting. It also extracts key skills from the job description.
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
2.  Paste your current CV into the "Your CV" text area. Your CV is automatically saved in your browser for future visits.
3.  Provide the job description by either pasting a URL and clicking "Fetch" or pasting the text directly.
4.  Click the **Tailor My CV** button.
5.  Your new, tailored CV will appear below, along with extracted keywords. You can then copy it to your clipboard.

### Live Chat

1.  Navigate to the **Live Chat** tab.
2.  Click the microphone icon to start the conversation. You will need to grant microphone permissions.
3.  Start speaking. The conversation will be transcribed in real-time.
4.  Click the stop icon to end the session.
