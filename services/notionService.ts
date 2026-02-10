import { JobData } from '../types';

export async function saveJobApplicationToNotion(
    jobData: JobData, 
    cvText: string, 
    coverLetter: string,
    notionKey: string,
    notionDbId: string
) {
    // Sanitize inputs
    const cleanKey = notionKey ? notionKey.trim().replace(/[^\x00-\x7F]/g, "") : "";
    const cleanDbId = notionDbId ? notionDbId.trim().replace(/[^\x00-\x7F]/g, "") : "";

    if (!cleanKey || !cleanDbId) {
        throw new Error("Notion API Key or Database ID is missing or invalid.");
    }

    // Construct the payload for Notion API
    // Note: This requires the database to have these specific properties.
    const payload = {
        parent: { database_id: cleanDbId },
        properties: {
            "Company": {
                title: [
                    {
                        text: {
                            content: jobData.companyName || "Unknown Company"
                        }
                    }
                ]
            },
            "Position": {
                rich_text: [
                    {
                        text: {
                            content: jobData.position || "Unknown Position"
                        }
                    }
                ]
            },
            "Status": {
                select: {
                    name: "Applied"
                }
            },
            "Date": {
                date: {
                    start: new Date().toISOString().split('T')[0] // YYYY-MM-DD
                }
            },
            "Link": {
                url: jobData.referenceUrl !== "Empty" ? jobData.referenceUrl : null
            },
            "Salary": {
                rich_text: [
                    {
                        text: {
                            content: jobData.salary || ""
                        }
                    }
                ]
            },
            // Assuming the DB might have a 'Next Action' text field
            "Next Action": {
                 rich_text: [
                    {
                        text: {
                            content: jobData.nextAction || ""
                        }
                    }
                ]
            }
        },
        children: [
            {
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ text: { content: "Job Description" } }]
                }
            },
            {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{ text: { content: "Reference Link: " + (jobData.referenceUrl || "N/A") } }]
                }
            },
             {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{ text: { content: jobData.companyDescription || "" } }]
                }
            },
            {
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ text: { content: "Cover Letter" } }]
                }
            },
            {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{ text: { content: coverLetter ? coverLetter.substring(0, 2000) : "No cover letter generated." } }]
                }
            },
            {
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{ text: { content: "Tailored CV" } }]
                }
            },
             {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{ text: { content: cvText ? cvText.substring(0, 2000) : "No CV generated." } }]
                }
            },
            // Note: Notion blocks have a 2000 character limit per block.
            // If the CV is longer, we might need to split it, but for now we truncate to avoid API errors.
             ...(cvText && cvText.length > 2000 ? [{
                 object: "block",
                 type: "paragraph",
                 paragraph: {
                     rich_text: [{ text: { content: cvText.substring(2000, 4000) } }]
                 }
             }] : [])
        ]
    };

    try {
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanKey}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Notion API Error: ${errorData.message || response.statusText}`);
        }

        return await response.json();
    } catch (error: any) {
        // Notion API blocks CORS by default. 
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error("CORS Error: The browser blocked the request to Notion. Use a proxy or backend.");
        }
        throw error;
    }
}