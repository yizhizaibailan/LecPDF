import React from 'react';
import { createRoot } from 'react-dom/client';

function LabShell(): React.JSX.Element {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 880, margin: '4rem auto', padding: '0 1.5rem' }}>
      <h1>LecPDF 风险验证实验室</h1>
      <p>共享 Electron 壳已就绪。后续实验将在此注册，所有结果仅写入本机。</p>
      <ul>
        <li>PDF 七类批注与打印</li>
        <li>PDF 智能夜间模式</li>
        <li>EPUB 锚点恢复</li>
        <li>EPUB TTS 句级高亮</li>
      </ul>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('renderer root missing');
createRoot(root).render(<LabShell />);
