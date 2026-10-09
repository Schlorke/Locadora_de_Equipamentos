declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string
    DIRECT_URL?: string
    NEXTAUTH_SECRET: string
    NEXTAUTH_DEBUG?: string
    RESEND_API_KEY?: string
    ZOHO_CLIENT_ID?: string
    ZOHO_CLIENT_SECRET?: string
    ZOHO_MAIL_DATACENTER?: string
    LOG_LEVEL?: string
  }
}
