const { contextBridge, ipcRenderer } = require('electron');

let markdownListener = null;
const queuedMarkdownFiles = [];

const deliverMarkdownFile = (file) => {
  if (!file || typeof file.name !== 'string' || typeof file.content !== 'string') return;
  if (markdownListener) {
    markdownListener(file);
  } else {
    queuedMarkdownFiles.push(file);
  }
};

ipcRenderer.on('marden:open-markdown', (_event, file) => {
  deliverMarkdownFile(file);
});

contextBridge.exposeInMainWorld('mardenDesktop', {
  openExternal(url) {
    return ipcRenderer.invoke('marden:open-external', url);
  },
  onOpenMarkdown(listener) {
    markdownListener = listener;
    while (queuedMarkdownFiles.length > 0) {
      markdownListener(queuedMarkdownFiles.shift());
    }
    return () => {
      if (markdownListener === listener) markdownListener = null;
    };
  },
});
