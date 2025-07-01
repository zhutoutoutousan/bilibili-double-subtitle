let settings = {
  targetLang: 'en',
  autoTranslate: true,
  fontSize: 'medium'
};

// Keep track of pending translations
const pendingTranslations = new Map();

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

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'settingsUpdated':
      settings = message.settings;
      updateSubtitleStyles();
      break;
    case 'translationRetrySuccess':
      handleTranslationRetrySuccess(message);
      break;
    case 'translationRetryFailed':
      handleTranslationRetryFailure(message);
      break;
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

  // If this text is already being translated, don't start another translation
  if (pendingTranslations.has(originalText)) return;

  try {
    pendingTranslations.set(originalText, true);

    // Send translation request to background script
    const response = await chrome.runtime.sendMessage({
      type: 'translateText',
      text: originalText,
      targetLang: settings.targetLang
    });

    if (response.error) {
      console.log('Initial translation failed, waiting for retry...', response.error);
      // Show loading state
      injectTranslatedSubtitle('Translating...', subtitlePanel, true);
      return;
    }

    pendingTranslations.delete(originalText);
    injectTranslatedSubtitle(response.translation, subtitlePanel);
  } catch (error) {
    pendingTranslations.delete(originalText);
    console.error('Translation error:', error);
    injectTranslatedSubtitle('Translation error. Please try again.', subtitlePanel, true);
  }
}

function handleTranslationRetrySuccess(message) {
  const subtitlePanel = document.querySelector('.bili-subtitle-x-subtitle-panel');
  if (!subtitlePanel) return;

  pendingTranslations.delete(message.originalText);
  injectTranslatedSubtitle(message.translation, subtitlePanel);
}

function handleTranslationRetryFailure(message) {
  const subtitlePanel = document.querySelector('.bili-subtitle-x-subtitle-panel');
  if (!subtitlePanel) return;

  pendingTranslations.delete(message.originalText);
  injectTranslatedSubtitle('Translation service unavailable. Please try again later.', subtitlePanel, true);
}

function injectTranslatedSubtitle(translatedText, subtitlePanel, isError = false) {
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
  translatedSubtitle.style.color = isError ? '#ff6b6b' : 'white';
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
      transition: color 0.3s ease;
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