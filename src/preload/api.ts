export type LecApi = Readonly<{
  app: Readonly<{
    version: string
  }>
}>

export function createAppApi(version: string): LecApi {
  return Object.freeze({
    app: Object.freeze({ version })
  })
}
