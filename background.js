chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startStudy') {
    console.log('Received startStudy message with topic:', request.topic, 'and duration:', request.duration);
    startStudySession(request.topic, request.duration);
    sendResponse({ status: 'Study session started' });
  }
});

let studyEndTime;
let studyInterval;

function startStudySession(topic, duration) {
  console.log('Starting study session for topic:', topic, 'for duration:', duration);
  studyEndTime = Date.now() + duration * 60 * 1000;

  // Get relevant keywords for the topic
  const keywords = generateHardcodedKeywords(topic);

  // Set interval to check tabs periodically
  studyInterval = setInterval(() => {
    if (Date.now() >= studyEndTime) {
      clearInterval(studyInterval);
      console.log('Study session ended');
      unblockDistractions();
      chrome.storage.local.remove('activeSession', () => {
        console.log('Active session cleared');
        chrome.runtime.sendMessage({ action: 'sessionEnded' });
      });
      return;
    }
    checkTabs(keywords);
  }, 5000);

  // Block distractions immediately
  blockDistractions();
}

function generateHardcodedKeywords(topic) {
  const keywordMap = {
    'data structures': ['binary tree', 'linked list', 'hash table', 'graph algorithms'],
    'machine learning': ['neural networks', 'supervised learning', 'support vector machines', 'deep learning']
  };
  
  return keywordMap[topic.toLowerCase()] || [];
}

function blockDistractions() {
  console.log('Blocking distractions...');
}

function unblockDistractions() {
  console.log('Unblocking distractions...');
}

async function checkTabs(keywords) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url.startsWith('http') && !tab.url.startsWith('https')) {
      // Skip tabs with unsupported schemes
      continue;
    }
    const isRelevant = await isRelevantTab(tab, keywords);
    if (!isRelevant) {
      console.log('Redirecting tab:', tab.url);
      chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('blocked.html') });
    }
  }
}

async function isRelevantTab(tab, keywords) {
  try {
    const title = tab.title.toLowerCase();
    const metaDescription = await fetchMetaDescription(tab.id);

    const content = `${title} ${metaDescription}`.toLowerCase();

    console.log(`Checking relevance for tab: ${tab.url}`);
    console.log(`Tab content: ${content}`);

    const isRelevant = keywords.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      const matches = content.includes(keywordLower);
      console.log(`Checking keyword: ${keywordLower}, matches: ${matches}`);
      return matches;
    });

    console.log(`Is tab relevant: ${isRelevant}`);
    return isRelevant;
  } catch (error) {
    console.error('Error checking tab relevance:', JSON.stringify(error));
    return false;
  }
}

async function fetchMetaDescription(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'fetchMetaDescription' }, response => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else if (response && response.metaDescription !== undefined) {
        resolve(response.metaDescription);
      } else {
        reject('No meta description found');
      }
    });
  });
}
