type AppProps = {
  version: string
}

export function App({ version }: AppProps): JSX.Element {
  return (
    <main className="project-shell">
      <section className="project-shell__card" aria-label="LecPDF 项目状态">
        <span className="project-shell__tag">LecPDF</span>
        <h1>项目骨架已就绪</h1>
        <p>版本 {version}</p>
      </section>
    </main>
  )
}
