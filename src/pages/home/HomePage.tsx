/**
 * 职责：渲染无文档打开时的开始页，并收口打开文件按钮的异步失败。
 * 异步说明：点击处理器等待注入的选择流程，拒绝会在页面边界安全结束。
 * 安全说明：页面只接收打开意图回调，不访问 Electron 桥接对象或文档数据层。
 * 资源说明：开始页不创建文件句柄、IPC 订阅或阅读器资源。
 */
import { FilePdfOutlined, FolderOpenOutlined } from '@ant-design/icons'

/** 表示开始页所需的唯一外部操作。 */
export type HomePageProps = {
  onOpenDocuments(): Promise<void>
}

/**
 * 导出开始页及其打开文件入口。
 */
export function HomePage({ onOpenDocuments }: HomePageProps): JSX.Element {
  const handleOpenDocuments = async (): Promise<void> => {
    try {
      await onOpenDocuments()
    } catch {
      // 对话框 IPC 失败不应逃逸为页面级未处理拒绝；用户可以再次点击重试。
    }
  }

  return (
    <main className="home-page">
      <section className="home-page__card" aria-labelledby="home-page-title">
        <FilePdfOutlined className="home-page__icon" aria-hidden="true" />
        <h1 id="home-page-title">欢迎使用 LecPDF</h1>
        <p>打开本地 PDF 或 EPUB 文档，继续你的阅读。</p>
        <button type="button" className="home-page__open" aria-label="打开文件" onClick={handleOpenDocuments}>
          <FolderOpenOutlined aria-hidden="true" />
          打开文件
        </button>
      </section>
    </main>
  )
}
