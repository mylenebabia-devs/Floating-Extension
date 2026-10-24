chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ce-toggle" });
  } catch (error) {
    console.warn("Chat Everywhere: reload this page, then click the icon again.", error);
  }
});
