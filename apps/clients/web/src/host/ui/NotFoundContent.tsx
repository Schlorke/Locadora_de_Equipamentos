/**
 * Conteúdo do 404 neutro (D10): o mesmo texto para locadora desconhecida, suspensa ou reservada e para caminho
 * inexistente. Não cita locadora nem plataforma; o Next acrescenta `noindex` a toda resposta 404.
 */
export function NotFoundContent() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço acessado não existe.</p>
    </main>
  )
}
