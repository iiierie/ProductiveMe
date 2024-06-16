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


// Function to check if content scripts are loaded in any active tabs
async function isContentScriptActive() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url.startsWith('http') || tab.url.startsWith('https')) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        return true; // If no error, content script is active
      } catch (error) {
        // Do nothing, continue to check other tabs
      }
    }
  }
  return false;
}

function startStudySession(topic, duration) {
  console.log('Starting study session for topic:', topic, 'for duration:', duration);
  studyEndTime = Date.now() + duration * 60 * 1000;

  // Get relevant keywords for the topic
  const keywords = generateHardcodedKeywords(topic);
  console.log(`Generated keywords: ${keywords.join(', ')}`); // Log the generated keywords

  // Set interval to check tabs periodically
  studyInterval = setInterval(async () => {
    if (Date.now() >= studyEndTime) {
      clearInterval(studyInterval);
      console.log('Study session ended');
      unblockDistractions();
      chrome.storage.local.remove('activeSession', async () => {
        console.log('Active session cleared');
        if (await isContentScriptActive()) {
          try {
            chrome.runtime.sendMessage({ action: 'sessionEnded' }, () => {
              if (chrome.runtime.lastError) {
                // console.error(`Error sending session ended message: ${chrome.runtime.lastError.message}`);
              }
            });
          } catch (error) {
            console.error(`Error sending session ended message: ${error}`);
          }
        } else {
          console.log('No active content scripts to send session ended message');
        }
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
    'machine learning': ['neural networks', 'supervised learning', 'support vector machines', 'deep learning'],
    'graphs': ['graph', 'graph algorithms', 'graph theory', 'graph data structure'] // Add keywords for 'graphs'
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
  console.log(`Checking tabs with keywords: ${keywords.join(', ')}`); // Log the keywords being used
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
    const url = tab.url.toLowerCase();
    
    // Allow Google search pages
    if (url.startsWith('https://www.google.com/search')) {
      console.log('Google search page detected, not blocking:', url);
      return true;
    }

    
    const title = tab.title.toLowerCase();
    const metaDescription = await fetchMetaDescription(tab.id);

    const content = `${title} ${metaDescription}`.toLowerCase();
    console.log(`Checking relevance for tab: ${tab.url}`);
    console.log(`Tab content: ${content}`);
    console.log(`Meta description: ${metaDescription}`);

    // Convert content into a set of unique words
    const words = new Set(content.split(/\W+/).filter(word => word));
    const wordList = Array.from(words); // Convert the set back to an array for logging

    // Log the keywords and the unique words list
    console.log(`Keywords: ${keywords.join(', ')}`);
    console.log(`Unique words in content: ${wordList.join(', ')}`);

    // Check if any keyword matches any word in the list
    const isRelevant = keywords.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      const matches = words.has(keywordLower);
      console.log(`Checking keyword: "${keywordLower}", matches: ${matches}`);
      return matches;
    });

    console.log(`Is tab relevant: ${isRelevant}`);
    return isRelevant;
  } catch (error) {
    console.error('Error checking tab relevance:', JSON.stringify(error));
    try {
      chrome.runtime.sendMessage({ action: 'sendMetadata', metaDescription: 'Error: ' + JSON.stringify(error) }, () => {
        if (chrome.runtime.lastError) {
          console.error(`Error sending metadata message: ${chrome.runtime.lastError.message}`);
        }
      });
    } catch (messageError) {
      console.error(`Error sending metadata message: ${messageError}`);
    }
    return false;
  }
}

async function fetchMetaDescription(tabId) {
  return new Promise((resolve, reject) => {
    if (chrome.scripting) {
      // Manifest V3 method
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          files: ['content.js'],
        },
        () => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError.message);
          }

          chrome.tabs.sendMessage(tabId, { action: 'fetchMetaDescription' }, response => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError.message);
            } else if (response && response.metaDescription !== undefined) {
              resolve(response.metaDescription);
            } else {
              reject('No meta description found');
            }
          });
        }
      );
    } else {
      // Manifest V2 method
      chrome.tabs.executeScript(tabId, { file: 'content.js' }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError.message);
        }

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
  }).catch(error => {
    // console.error(`Error fetching meta description for tab ${tabId}: ${error}`);
    return '';
  });
}
