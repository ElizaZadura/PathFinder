
// Helper to read file content based on extension

declare global {
  interface Window {
    mammoth: any;
    pdfjsLib: any;
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.docx')) {
    if (!window.mammoth) {
      throw new Error("Mammoth library not loaded.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } 
  
  else if (fileName.endsWith('.pdf')) {
    if (!window.pdfjsLib) {
      throw new Error("PDF.js library not loaded.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    return fullText;
  } 
  
  else {
    // Default to text for .txt, .md, etc.
    return await file.text();
  }
}
