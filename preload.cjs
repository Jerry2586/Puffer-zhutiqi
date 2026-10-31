'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hetunTheme',Object.freeze({downloadAuthoringKit:()=>ipcRenderer.invoke('theme:download-authoring-kit'),saveExport:v=>ipcRenderer.invoke('theme:save-export',v),getAppearance:()=>ipcRenderer.invoke('theme:get-appearance'),setAppearance:v=>ipcRenderer.invoke('theme:set-appearance',v)}));
