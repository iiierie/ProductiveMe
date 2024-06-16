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
  } else if (request.action === 'sendMetadata') {
    console.log('Meta Description:', request.metaDescription);
  }
});

let timerInterval;

function updatePopup(topic, endTime) {
  document.getElementById('studyFormContainer').style.display = 'none';
  document.getElementById('activeSessionContainer').style.display = 'block';
  document.getElementById('activeTopic').textContent = `You are studying for "${topic}"`;
  updateTimer(endTime);

  // Clear any existing interval
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  // Update the timer every second
  timerInterval = setInterval(() => {
    updateTimer(endTime);
  }, 1000);
}

function resetPopup() {
  document.getElementById('studyFormContainer').style.display = 'block';
  document.getElementById('activeSessionContainer').style.display = 'none';
  if (timerInterval) {
    clearInterval(timerInterval);
  }
}

function updateTimer(endTime) {
  const currentTime = new Date();
  const timeRemaining = endTime - currentTime;

  if (timeRemaining <= 0) {
    document.getElementById('activeEndTime').textContent = 'Time is up!';
    resetPopup();
    chrome.storage.local.remove('activeSession');
    return;
  }

  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  document.getElementById('activeEndTime').textContent = `Blocking distractions for ${minutes}m ${seconds}s`;
}
