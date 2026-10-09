import { useState } from 'react'
import { Text, View } from 'react-native'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Card,
  Input,
  Switch,
  Textarea,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  STOREFRONT_LEGAL_KINDS,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import { NOMES_DOS_TEXTOS, useTextosLegais } from '../model/use-textos-legais'
import {
  comNovaSecao,
  dataPorExtenso,
  moverSecao,
  type FormularioDoTexto,
  type SecaoDoFormulario,
} from '../model/textos-legais'

const dataCurta = (iso: string) => {
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? iso : dataPorExtenso(data)
}

/**
 * Textos legais no app (onda 134, B10): o mesmo editor da web (seções na sintaxe leve), com a confirmação antes de
 * publicar (a versão anterior deixa de existir; D-F) e de despublicar, e os avisos de Termos e Privacidade ausentes.
 */
export function TextosLegais() {
  const theme = useTheme()
  const textos = useTextosLegais()
  const [tipo, setTipo] = useState<StorefrontLegalKind>('terms')
  const [confirmar, setConfirmar] = useState<'publicar' | 'despublicar' | null>(
    null
  )
  const estado = textos.estados[tipo]
  const form = textos.formularios[tipo]
  const editar = (novo: FormularioDoTexto) => textos.editar(tipo, novo)
  const secao = (indice: number, parcial: Partial<SecaoDoFormulario>) =>
    editar({
      ...form,
      secoes: form.secoes.map((item, atual) =>
        atual === indice ? { ...item, ...parcial } : item
      ),
    })
  const aviso = (texto: string) => (
    <Text accessibilityRole="alert" style={{ color: theme.danger }}>
      {texto}
    </Text>
  )
  return (
    <Card>
      <View style={{ gap: space.md }}>
        <Text
          accessibilityRole="header"
          style={{ color: theme.text, fontWeight: typography.weight.bold }}
        >
          Textos Legais
        </Text>
        {textos.faltamTermos
          ? aviso(
              'Os Termos de Uso não estão publicados: o pedido de orçamento segue sem a caixa de aceite dos Termos.'
            )
          : null}
        {textos.faltaPrivacidade
          ? aviso(
              'A Política de Privacidade não está publicada: o site fica sem a página de Privacidade.'
            )
          : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {STOREFRONT_LEGAL_KINDS.map((kind) => (
            <Button
              key={kind}
              variant={kind === tipo ? 'default' : 'outline'}
              onClick={() => setTipo(kind)}
            >
              {NOMES_DOS_TEXTOS[kind]}
            </Button>
          ))}
        </View>
        {!estado.carregado ? (
          <Text style={{ color: theme.textMuted }}>
            Carregando documento...
          </Text>
        ) : estado.erro ? (
          aviso(estado.erro)
        ) : (
          <>
            <Text style={{ color: theme.textMuted }}>
              {estado.documento
                ? `Publicado no site${estado.publicadoEm ? ` em ${dataCurta(estado.publicadoEm)}` : ''}.`
                : 'Não publicado.'}
            </Text>
            <Input
              aria-label="Última atualização"
              value={form.lastUpdated}
              onChangeText={(valor) => editar({ ...form, lastUpdated: valor })}
            />
            <Button
              variant="outline"
              onClick={() =>
                editar({ ...form, lastUpdated: dataPorExtenso(new Date()) })
              }
            >
              Usar a data de hoje
            </Button>
            <Textarea
              aria-label="Introdução (opcional)"
              value={form.intro}
              onChangeText={(valor) => editar({ ...form, intro: valor })}
            />
            <Text style={{ color: theme.textMuted }}>
              No texto de cada seção: linha em branco separa parágrafos; uma
              linha que começa com &quot;- &quot; é um item de lista;
              &quot;**Rótulo:**&quot; no começo do item vira destaque.
            </Text>
            {form.secoes.map((item, indice) => (
              <View key={indice} style={{ gap: space.xs }}>
                <Input
                  aria-label={`Seção ${indice + 1}: título`}
                  value={item.titulo}
                  onChangeText={(valor) => secao(indice, { titulo: valor })}
                />
                <Textarea
                  aria-label={`Seção ${indice + 1}: texto`}
                  value={item.texto}
                  onChangeText={(valor) => secao(indice, { texto: valor })}
                />
                <Text style={{ color: theme.text }}>
                  Mostrar meus contatos no fim da seção
                </Text>
                <Switch
                  aria-label={`Seção ${indice + 1}: mostrar meus contatos`}
                  checked={item.cartao}
                  onCheckedChange={(valor) =>
                    secao(indice, { cartao: valor === true })
                  }
                />
                {item.cartao ? (
                  <Input
                    aria-label={`Seção ${indice + 1}: frase do cartão de contato (opcional)`}
                    value={item.nota}
                    onChangeText={(valor) => secao(indice, { nota: valor })}
                  />
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: space.sm,
                  }}
                >
                  <Button
                    variant="outline"
                    disabled={indice === 0}
                    onClick={() => editar(moverSecao(form, indice, -1))}
                  >
                    Subir
                  </Button>
                  <Button
                    variant="outline"
                    disabled={indice === form.secoes.length - 1}
                    onClick={() => editar(moverSecao(form, indice, 1))}
                  >
                    Descer
                  </Button>
                  <Button
                    variant="outline"
                    disabled={form.secoes.length === 1}
                    onClick={() =>
                      editar({
                        ...form,
                        secoes: form.secoes.filter(
                          (_item, atual) => atual !== indice
                        ),
                      })
                    }
                  >
                    Remover seção
                  </Button>
                </View>
              </View>
            ))}
            <Button
              variant="outline"
              onClick={() => editar(comNovaSecao(form))}
            >
              Adicionar seção
            </Button>
            {estado.documento ? (
              <Button
                variant="outline"
                disabled={textos.ocupado === tipo}
                onClick={() => setConfirmar('despublicar')}
              >
                Despublicar
              </Button>
            ) : null}
            <Button
              disabled={textos.ocupado === tipo}
              onClick={() => setConfirmar('publicar')}
            >
              {textos.ocupado === tipo ? 'Publicando...' : 'Publicar'}
            </Button>
          </>
        )}
      </View>
      <AlertDialog
        open={confirmar !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmar(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirmar === 'despublicar'
              ? 'Retirar do site?'
              : 'Publicar esta versão?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmar === 'despublicar'
              ? `A página de ${NOMES_DOS_TEXTOS[tipo]} deixa de existir no site, e o texto publicado deixa de existir: guarde uma cópia se precisar dele.`
              : estado.documento
                ? 'O site passa a mostrar esta versão, e a versão publicada hoje deixa de existir: guarde uma cópia se precisar dela.'
                : 'O documento passa a aparecer no site da sua locadora.'}
          </AlertDialogDescription>
          <View style={{ gap: space.sm }}>
            <Button variant="outline" onClick={() => setConfirmar(null)}>
              Voltar
            </Button>
            <Button
              onClick={() => {
                const acao = confirmar
                setConfirmar(null)
                if (acao === 'despublicar') void textos.despublicar(tipo)
                else void textos.publicar(tipo)
              }}
            >
              {confirmar === 'despublicar' ? 'Despublicar' : 'Publicar'}
            </Button>
          </View>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
