import React from 'react';
import { createRoot } from 'react-dom/client';
import { pdfAnnotationsPrintLab } from '../../../labs/pdf-annotations-print/index';

function LabShell(): React.JSX.Element {
  const labHost = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!labHost.current) return;
    const host = labHost.current;
    let disposed = false;
    void pdfAnnotationsPrintLab.mount(host).then((handle) => {
      if (disposed) void handle.dispose();
    });
    return () => {
      disposed = true;
    };
  }, []);

  return <div ref={labHost} style={{ width: '100vw', height: '100vh' }} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('renderer root missing');
createRoot(root).render(<LabShell />);
