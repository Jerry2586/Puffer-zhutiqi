'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hetunTheme',Object.freeze({saveExport:v=>ipcRenderer.invoke('theme:save-export',v)}));
