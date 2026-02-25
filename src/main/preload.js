const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexus', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },
  games: {
    getAll:  ()         => ipcRenderer.invoke('games:getAll'),
    add:     (game)     => ipcRenderer.invoke('games:add', game),
    delete:  (id)       => ipcRenderer.invoke('games:delete', id),
    update:  (id, data) => ipcRenderer.invoke('games:update', id, data),
    launch:  (id)       => ipcRenderer.invoke('games:launch', id),
    stop:    (id)       => ipcRenderer.invoke('games:stop', id),
  },
  dialog: {
    openFile:   () => ipcRenderer.invoke('dialog:openFile'),
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  },
  folder: {
    scan: (folderPath, depth) => ipcRenderer.invoke('folder:scan', folderPath, depth),
  },
  shell: {
    openFolder:   (p)   => ipcRenderer.invoke('shell:openFolder', p),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
  on: (event, cb) => {
    ipcRenderer.on(event, (_, ...args) => cb(...args));
    return () => ipcRenderer.removeAllListeners(event);
  },
});
