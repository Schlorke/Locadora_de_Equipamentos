/** Contrato da tela de recuperação de senha, igual no web e no app. */
export interface RecuperarSenhaPageProps {
  /**
   * Casca em que a tela aparece, escolhida pelo host. `storefront` (padrão): sob o cabeçalho da vitrine, com a marca
   * da locadora. `platform` (fluxos de conta no host `app`): abaixo da barra da plataforma, com o nome provisório da
   * plataforma (`PLATFORM.displayName`) no lugar da marca.
   */
  shell?: "storefront" | "platform";
}
