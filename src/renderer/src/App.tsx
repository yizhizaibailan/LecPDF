import { Empty, Typography } from 'antd'
import { SolarIcon } from './SolarIcon'

type AppProps = {
  version: string
}

export function App({ version }: AppProps): JSX.Element {
  return (
    <main className="project-shell">
      <section className="project-shell__card" aria-label="LecPDF 项目状态">
        <span className="project-shell__tag">LecPDF</span>
        <Empty
          image={<SolarIcon className="project-shell__icon" name="book-2-linear" width="72" aria-hidden />}
          description={
            <div className="project-shell__description">
              <Typography.Title level={1}>项目骨架已就绪</Typography.Title>
              <Typography.Text>版本 {version}</Typography.Text>
            </div>
          }
        />
      </section>
    </main>
  )
}
