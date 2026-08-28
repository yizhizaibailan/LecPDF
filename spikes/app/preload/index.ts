import { contextBridge, ipcRenderer } from 'electron';
import { assertLabResult, type LabResult } from '../shared/lab-contract';

const api = Object.freeze({
  async saveResult(value: LabResult): Promise<void> {
    assertLabResult(value);
    await ipcRenderer.invoke('lab:save-result', value);
  },
});

contextBridge.exposeInMainWorld('lecSpike', api);
