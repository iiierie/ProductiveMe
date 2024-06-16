chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchMetaDescription') {
    const metaTag = document.querySelector('meta[name="description"]');
    const metaDescription = metaTag ? metaTag.getAttribute('content') : '';
    sendResponse({ metaDescription });
  }
});
