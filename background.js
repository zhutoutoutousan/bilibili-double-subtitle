// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.set({
    targetLang: 'en',
    autoTranslate: true,
    fontSize: 'medium'
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'translateText') {
    // Fire and forget style translation
    translateText(request.text, request.targetLang)
      .then(translatedText => {
        if (translatedText) {
          sendResponse({ translation: translatedText });
        } else {
          // Silently try backup without waiting for response
          translateTextBackup(request.text, request.targetLang)
            .then(backupText => {
              if (backupText) {
                sendResponse({ translation: backupText });
              }
            })
            .catch(() => {
              // Ignore backup errors
              sendResponse({ translation: request.text });
            });
        }
      })
      .catch(() => {
        // On error, just pass through original text
        sendResponse({ translation: request.text });
      });
    return true; // Will respond asynchronously
  }
});

// Primary translation function using Google Translate API
async function translateText(text, targetLang) {
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data?.[0]?.[0]?.[0] || null;
  } catch {
    return null;
  }
}

// Backup translation function using alternative endpoint
async function translateTextBackup(text, targetLang) {
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/t?client=at&sl=auto&tl=${targetLang}&q=${encodeURIComponent(text)}`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    // Try multiple response formats
    return data?.sentences?.[0]?.trans || 
           (Array.isArray(data) ? data[0] : null) ||
           null;
  } catch {
    return null;
  }
} 