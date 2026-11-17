// Copy this file to environment.ts and fill in your API keys
// DO NOT commit environment.ts to version control

export const environment = {
  production: false,
  deepl: {
    // Replace with your DeepL API key
    // Get from: https://www.deepl.com/pro-api
    apiKey: 'YOUR_DEEPL_API_KEY_HERE',
    // Optional: DeepL Glossary ID for terminology
    // Get from: https://www.deepl.com/fr/glossary/
    glossaryId: 'YOUR_GLOSSARY_ID_HERE',
    enabled: true,
  },
}
