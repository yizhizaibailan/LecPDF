/**
 * 渲染无文档打开时的开始页。
 * 页面只接收打开意图回调，不访问 Electron 桥接对象或文档数据层。
 */
import { FilePdfOutlined, FolderOpenOutlined } from '@ant-design/icons'

/** 表示开始页所需的唯一外部操作。 */
export type HomePageProps = {
  onOpenDocuments(): Promise<void>
}

/**
 * 导出开始页及其打开文件入口。
 * 点击时以 void 触发异步选择流程，避免 React 事件处理器等待 IPC；错误处理由注入的组合层负责。
 */
export function HomePage({ onOpenDocuments }: HomePageProps): JSX.Element {
  return (
    <main className="home-page">
      <section className="home-page__card" aria-labelledby="home-page-title">
        <FilePdfOutlined className="home-page__icon" aria-hidden="true" />
        <h1 id="home-page-title">欢迎使用 LecPDF</h1>
        <p>打开本地 PDF 或 EPUB 文档，继续你的阅读。</p>
        <button type="button" className="home-page__open" aria-label="打开文件" onClick={() => { void onOpenDocuments() }}>
          <FolderOpenOutlined aria-hidden="true" />
          打开文件
        </button>
      </section>
    </main>
  )
}
