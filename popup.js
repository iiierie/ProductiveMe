document.getElementById('studyForm').addEventListener('submit', function(event) {
  event.preventDefault();
  const topic = document.getElementById('topic').value;
  const duration = parseInt(document.getElementById('duration').value);
  const endTime = new Date(Date.now() + duration * 60000);

  chrome.runtime.sendMessage({ action: 'startStudy', topic: topic, duration: duration }, function(response) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    console.log(response.status);
    updatePopup(topic, endTime);
    chrome.storage.local.set({ activeSession: { topic, endTime: endTime.toString() } });
  });
});

document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['activeSession'], function(result) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    if (result.activeSession) {
      const { topic, endTime } = result.activeSession;
      if (new Date(endTime) > Date.now()) {
        updatePopup(topic, new Date(endTime));
      } else {
        chrome.storage.local.remove('activeSession');
        resetPopup();
      }
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sessionEnded') {
    resetPopup();
  }
});

function updatePopup(topic, endTime) {
  document.getElementById('studyFormContainer').style.display = 'none';
  document.getElementById('activeSessionContainer').style.display = 'block';
  document.getElementById('activeTopic').textContent = `You are studying for "${topic}"`;
  document.getElementById('activeEndTime').textContent = `Blocking distractions until ${endTime.toLocaleTimeString()}`;
}

function resetPopup() {
  document.getElementById('studyFormContainer').style.display = 'block';
  document.getElementById('activeSessionContainer').style.display = 'none';
}
