import { Prisma, type Setting } from '@prisma/client'

/**
 * Linha de `settings` lida pelo teste, pronta para ser recriada com `prisma.setting.create` (restauração do estado da
 * fixture). Os textos legais da vitrine (onda 134) são `Json?`: o `null` lido precisa voltar como o NULL do SQL
 * (`Prisma.DbNull`); o `null` cru o Prisma grava como o `null` do JSON, que o CHECK de forma da coluna recusa
 * (`settings_*_document_object`), e a restauração falhava no meio do arquivo.
 */
export function settingRowForCreate(
  row: Setting
): Prisma.SettingUncheckedCreateInput {
  return {
    ...(row as unknown as Prisma.SettingUncheckedCreateInput),
    termsDocument: row.termsDocument ?? Prisma.DbNull,
    privacyDocument: row.privacyDocument ?? Prisma.DbNull,
    returnPolicyDocument: row.returnPolicyDocument ?? Prisma.DbNull,
  }
}
