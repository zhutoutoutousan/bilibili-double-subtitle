let settings = {
  targetLang: 'en',
  autoTranslate: true,
  fontSize: 'medium'
};

// Load settings when content script starts
chrome.storage.sync.get(
  {
    targetLang: 'en',
    autoTranslate: true,
    fontSize: 'medium'
  },
  (items) => {
    settings = items;
    initializeTranslation();
  }
);

// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsUpdated') {
    settings = message.settings;
    updateSubtitleStyles();
  }
});

function initializeTranslation() {
  // Create observer to watch for subtitle updates
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const subtitlePanel = document.querySelector('.bili-subtitle-x-subtitle-panel');
        if (subtitlePanel) {
          handleSubtitleUpdate(subtitlePanel);
        }
      }
    });
  });

  // Start observing the subtitle container
  const subtitleContainer = document.querySelector('.bpx-player-subtitle-wrap');
  if (subtitleContainer) {
    observer.observe(subtitleContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Initial setup of subtitle styles
  updateSubtitleStyles();
}

async function handleSubtitleUpdate(subtitlePanel) {
  if (!settings.autoTranslate) return;

  const originalText = subtitlePanel.querySelector('.bili-subtitle-x-subtitle-panel-text')?.textContent;
  if (!originalText) return;

  try {
    const translatedText = await translateText(originalText, settings.targetLang);
    injectTranslatedSubtitle(translatedText, subtitlePanel);
  } catch (error) {
    console.error('Translation error:', error);
  }
}

async function translateText(text, targetLang) {
  // Using Google Translate API
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data[0][0][0];
  } catch (error) {
    throw new Error('Translation failed: ' + error.message);
  }
}

function injectTranslatedSubtitle(translatedText, subtitlePanel) {
  const minorGroup = subtitlePanel.querySelector('.bili-subtitle-x-subtitle-panel-minor-group');
  if (!minorGroup) return;

  // Create or update translated subtitle
  let translatedSubtitle = minorGroup.querySelector('.translated-subtitle');
  if (!translatedSubtitle) {
    translatedSubtitle = document.createElement('div');
    translatedSubtitle.className = 'translated-subtitle';
    translatedSubtitle.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    translatedSubtitle.style.padding = '2px 4px';
    translatedSubtitle.style.marginTop = '5px';
    minorGroup.appendChild(translatedSubtitle);
  }
  translatedSubtitle.textContent = translatedText;
}

function updateSubtitleStyles() {
  const fontSizes = {
    small: '12px',
    medium: '14px',
    large: '16px'
  };

  const style = document.createElement('style');
  style.textContent = `
    .bili-subtitle-x-subtitle-panel-minor-group .translated-subtitle {
      font-size: ${fontSizes[settings.fontSize]} !important;
      color: white !important;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8) !important;
    }
  `;

  // Remove any existing style
  const existingStyle = document.querySelector('style[data-subtitle-styles]');
  if (existingStyle) {
    existingStyle.remove();
  }

  style.setAttribute('data-subtitle-styles', '');
  document.head.appendChild(style);
} 