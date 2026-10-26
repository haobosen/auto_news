// 点击扩展图标时，在新标签页打开应用（后端需在本机运行）
const APP_URL = 'http://127.0.0.1:8000'

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: APP_URL })
})
