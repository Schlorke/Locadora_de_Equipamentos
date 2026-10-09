'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Switch,
  Textarea,
} from '@gb-locacoes/ui'
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
 * Textos legais da locadora (onda 134, B10; decisão do dono de 2026-10-06, item 3): Termos, Privacidade e Devolução,
 * editados por seção na sintaxe leve e publicados pela rota própria. Publicar substitui a versão anterior (que deixa
 * de existir: guardar versões é a D-F) e despublicar tira a página do site; os dois pedem confirmação. Avisa quando
 * faltam os Termos (o orçamento segue sem a caixa de aceite; D-C, parte 1) ou a Privacidade. Só `@gb-locacoes/ui` e
 * tokens.
 */
export function TextosLegais() {
  const textos = useTextosLegais()
  const [tipo, setTipo] = useState<StorefrontLegalKind>('terms')
  const estado = textos.estados[tipo]
  const form = textos.formularios[tipo]
  const ocupado = textos.ocupado === tipo
  const editar = (novo: FormularioDoTexto) => textos.editar(tipo, novo)
  const secao = (indice: number, parcial: Partial<SecaoDoFormulario>) =>
    editar({
      ...form,
      secoes: form.secoes.map((item, atual) =>
        atual === indice ? { ...item, ...parcial } : item
      ),
    })
  return (
    <Card>
      <CardContent className="space-y-6 p-4 md:p-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-foreground">
            Textos legais
          </h3>
          <p className="text-sm text-muted-foreground">
            Termos, Política de Privacidade e Política de Devolução da sua
            locadora. Sem o documento publicado, a página não existe no site.
          </p>
        </div>
        {textos.faltamTermos ? (
          <p role="status" className="text-sm text-destructive">
            Os Termos de Uso não estão publicados: o pedido de orçamento segue
            sem a caixa de aceite dos Termos.
          </p>
        ) : null}
        {textos.faltaPrivacidade ? (
          <p role="status" className="text-sm text-destructive">
            A Política de Privacidade não está publicada: o site fica sem a
            página de Privacidade.
          </p>
        ) : null}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Documento"
        >
          {STOREFRONT_LEGAL_KINDS.map((kind) => (
            <Button
              key={kind}
              type="button"
              variant={kind === tipo ? 'default' : 'outline'}
              aria-pressed={kind === tipo}
              onClick={() => setTipo(kind)}
            >
              {NOMES_DOS_TEXTOS[kind]}
            </Button>
          ))}
        </div>
        {!estado.carregado ? (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando documento...
          </p>
        ) : estado.erro ? (
          <p role="alert" className="text-sm text-destructive">
            {estado.erro}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {estado.documento
                ? `Publicado no site${estado.publicadoEm ? ` em ${dataCurta(estado.publicadoEm)}` : ''}.`
                : 'Não publicado.'}
            </p>
            <div className="space-y-1">
              <Label htmlFor="texto-legal-data">Última atualização</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="texto-legal-data"
                  value={form.lastUpdated}
                  onChange={(event) =>
                    editar({ ...form, lastUpdated: event.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    editar({ ...form, lastUpdated: dataPorExtenso(new Date()) })
                  }
                >
                  Usar a data de hoje
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="texto-legal-intro">Introdução (opcional)</Label>
              <Textarea
                id="texto-legal-intro"
                value={form.intro}
                rows={3}
                onChange={(event) =>
                  editar({ ...form, intro: event.target.value })
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              No texto de cada seção: linha em branco separa parágrafos; uma
              linha que começa com &quot;- &quot; é um item de lista;
              &quot;**Rótulo:**&quot; no começo do item vira destaque. O texto
              aparece como texto, sem links nem formatação.
            </p>
            {form.secoes.map((item, indice) => (
              <fieldset
                key={indice}
                className="space-y-2 border-t border-border pt-4"
              >
                <legend className="text-sm font-medium text-foreground">
                  Seção {indice + 1}
                </legend>
                <Input
                  aria-label={`Seção ${indice + 1}: título`}
                  placeholder="Título"
                  value={item.titulo}
                  onChange={(event) =>
                    secao(indice, { titulo: event.target.value })
                  }
                />
                <Textarea
                  aria-label={`Seção ${indice + 1}: texto`}
                  value={item.texto}
                  rows={8}
                  onChange={(event) =>
                    secao(indice, { texto: event.target.value })
                  }
                />
                <div className="flex items-center gap-2">
                  <Switch
                    id={`secao-${indice}-cartao`}
                    checked={item.cartao}
                    onCheckedChange={(valor) =>
                      secao(indice, { cartao: valor === true })
                    }
                  />
                  <Label htmlFor={`secao-${indice}-cartao`}>
                    Mostrar meus contatos no fim da seção
                  </Label>
                </div>
                {item.cartao ? (
                  <Input
                    aria-label={`Seção ${indice + 1}: frase do cartão de contato (opcional)`}
                    placeholder="Frase do cartão de contato (opcional)"
                    value={item.nota}
                    onChange={(event) =>
                      secao(indice, { nota: event.target.value })
                    }
                  />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={indice === 0}
                    onClick={() => editar(moverSecao(form, indice, -1))}
                  >
                    Subir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={indice === form.secoes.length - 1}
                    onClick={() => editar(moverSecao(form, indice, 1))}
                  >
                    Descer
                  </Button>
                  <Button
                    type="button"
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
                </div>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => editar(comNovaSecao(form))}
            >
              Adicionar seção
            </Button>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              {estado.documento ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={ocupado}>
                      Despublicar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Retirar do site?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription>
                      {`A página de ${NOMES_DOS_TEXTOS[tipo]} deixa de existir no site, e o texto publicado deixa de existir: guarde uma cópia se precisar dele.`}
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void textos.despublicar(tipo)}
                      >
                        Despublicar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="default" disabled={ocupado}>
                    {ocupado ? 'Publicando...' : 'Publicar'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publicar esta versão?</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription>
                    {estado.documento
                      ? 'O site passa a mostrar esta versão, e a versão publicada hoje deixa de existir: guarde uma cópia se precisar dela.'
                      : 'O documento passa a aparecer no site da sua locadora.'}
                  </AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void textos.publicar(tipo)}
                    >
                      Publicar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
