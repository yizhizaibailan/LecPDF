/**
 * 读写应用配置并提供安全默认值；通过 DataStore 的原子写入避免窗口与设置状态损坏。
 */
import { CURRENT_SCHEMA_VERSION, type Config } from '../shared/schema'
import { DataStore } from './dataStore'
import { SchemaMigrator } from './schemaMigration'
import { DEFAULT_WINDOW_BOUNDS, type SavedWindowGeometry } from './window-geometry'

const CONFIG_PATH = 'config.json'

export function createDefaultConfig(): Config {
  return {
    version: CURRENT_SCHEMA_VERSION,
    language: 'zh-CN',
    appearance: { theme: 'system' },
    reading: { defaultZoom: 100, defaultLayout: 'continuous', pdfNightMode: false, pageAnimation: true },
    annotation: {
      defaultColors: {
        highlight: '#fff1a8',
        underline: '#1677ff',
        strikeout: '#f5222d',
        squiggly: '#722ed1',
        note: '#faad14',
        freetext: '#1677ff',
        ink: '#fa8c16'
      }
    },
    shortcuts: {
      open: 'Ctrl+O',
      closeTab: 'Ctrl+W',
      search: 'Ctrl+F',
      highlight: 'H',
      underline: 'U',
      strikeout: 'D',
      squiggly: 'W',
      note: 'N',
      ink: 'P',
      fullscreen: 'F11',
      print: 'Ctrl+P',
      undo: 'Ctrl+Z',
      redo: 'Ctrl+Y',
      zoomIn: 'Ctrl+=',
      zoomOut: 'Ctrl+-',
      zoomReset: 'Ctrl+0'
    },
    general: {
      launchAtStartup: false,
      autoBackup: { enabled: true, intervalDays: 7, keep: 3 }
    },
    window: {
      bounds: structuredClone(DEFAULT_WINDOW_BOUNDS),
      maximized: false
    }
  }
}

export class ConfigStore {
  private config: Config | null = null
  private readOnly = false

  constructor(private readonly dataStore: DataStore) {}

  async load(): Promise<Config> {
    if (this.config !== null) {
      return structuredClone(this.config)
    }

    const storedConfig = await this.dataStore.readJson<Config>(CONFIG_PATH)
    if (storedConfig === null) {
      this.config = createDefaultConfig()
      return structuredClone(this.config)
    }

    const result = new SchemaMigrator<Config>(CURRENT_SCHEMA_VERSION, {}).migrate(storedConfig)
    this.config = result.document
    this.readOnly = result.mode === 'readOnly'
    return structuredClone(this.config)
  }

  async saveWindowGeometry(geometry: SavedWindowGeometry): Promise<boolean> {
    const config = await this.load()
    if (this.readOnly) {
      return false
    }

    this.config = {
      ...config,
      window: structuredClone(geometry)
    }
    await this.dataStore.writeJson(CONFIG_PATH, this.config)
    return true
  }
}
