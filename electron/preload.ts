import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type CardApi } from './ipc/contract'

// The single, audited bridge between the sandboxed renderer and the main
// process. The renderer asks for OUTCOMES here — never hardware operations.

/** Platform bridge: runtime info + a liveness check. */
const electronAPI = {
  getVersions: (): Promise<{
    electron: string
    chrome: string
    node: string
    v8: string
  }> => ipcRenderer.invoke('app:getVersions'),

  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
}

/** Domain bridge: the card-management capability surface (spec §5). */
const cardApi: CardApi = {
  listPatients: () => ipcRenderer.invoke(CHANNELS.listPatients),
  registerPatient: (input) => ipcRenderer.invoke(CHANNELS.registerPatient, input),
  seedDemoPatient: () => ipcRenderer.invoke(CHANNELS.seedDemoPatient),
  listCardsByPatient: (patientId) => ipcRenderer.invoke(CHANNELS.listCardsByPatient, patientId),
  cardHistory: (cardRecordId) => ipcRenderer.invoke(CHANNELS.cardHistory, cardRecordId),
  issueForPatient: (patientId, options) => ipcRenderer.invoke(CHANNELS.issueForPatient, patientId, options),
  resumeIssue: (cardRecordId, options) => ipcRenderer.invoke(CHANNELS.resumeIssue, cardRecordId, options),
  checkIn: (cardRecordId) => ipcRenderer.invoke(CHANNELS.checkIn, cardRecordId),
  reportLost: (cardRecordId) => ipcRenderer.invoke(CHANNELS.reportLost, cardRecordId),
  reissue: (cardRecordId) => ipcRenderer.invoke(CHANNELS.reissue, cardRecordId),
  voidCard: (cardRecordId) => ipcRenderer.invoke(CHANNELS.voidCard, cardRecordId),
  hardwareStatus: () => ipcRenderer.invoke(CHANNELS.hardwareStatus),
  getSetting: (key) => ipcRenderer.invoke(CHANNELS.getSetting, key),
  updateSetting: (key, value) => ipcRenderer.invoke(CHANNELS.updateSetting, key, value),
  bulkRegisterPatients: (patients) => ipcRenderer.invoke(CHANNELS.bulkRegisterPatients, patients),
  listDesigns: () => ipcRenderer.invoke(CHANNELS.listDesigns),
  createDesign: (name, front, back) => ipcRenderer.invoke(CHANNELS.createDesign, name, front, back),
  deleteDesign: (id) => ipcRenderer.invoke(CHANNELS.deleteDesign, id),
  setDefaultDesign: (id) => ipcRenderer.invoke(CHANNELS.setDefaultDesign, id),
  getDefaultDesign: () => ipcRenderer.invoke(CHANNELS.getDefaultDesign),
  listAllCards: () => ipcRenderer.invoke(CHANNELS.listAllCards),
  downloadPdf: (cardRecordId, options) => ipcRenderer.invoke(CHANNELS.downloadPdf, cardRecordId, options),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
contextBridge.exposeInMainWorld('cardApi', cardApi)

export type ElectronAPI = typeof electronAPI
