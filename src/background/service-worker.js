import { getSettings, initializeSettings } from "../shared/config.js";

chrome.runtime.onInstalled.addListener(() => {
  void initializeSettings();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeSettings();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "settings:get") {
    return false;
  }

  void getSettings().then(sendResponse);
  return true;
});
