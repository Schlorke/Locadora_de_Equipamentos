"use client";
import { registrationLoginUrl } from "../../../features/cadastrar";
import { Alert, AlertDescription, Button, Card, Input, Label, Link, Stack, Text } from "../../../shared/ui";
import { useRegistration, type CadastroPageProps, type RegistrationField } from "../model/use-registration";
import { useMarcaDoAcesso } from "../../../entities/organizacao";

const fields: Array<{ name: RegistrationField; label: string; placeholder: string; type?: string }> = [
  { name: "name", label: "Nome Completo", placeholder: "Seu nome completo" },
  { name: "email", label: "E-mail", placeholder: "seu@email.com", type: "email" },
  { name: "phone", label: "Telefone", placeholder: "(51) 99999-9999", type: "tel" },
  { name: "cep", label: "CEP", placeholder: "00000-000" },
  { name: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { name: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
];

export function CadastroPage(props: CadastroPageProps) {
  const model = useRegistration(props);
  // Sigla da própria locadora (cartão público), nunca a da GB (achado 143).
  const marca = useMarcaDoAcesso();
  return <Stack padding="lg"><Card><Stack gap="lg">
    <Text size="xl" heading={1}>{marca.sigla}</Text>
    <Text size="lg" heading={2}>Criar Conta</Text>
    <Text tone="muted">Preencha os dados para criar sua conta</Text>
    {model.error ? <Alert><AlertDescription>{model.error}</AlertDescription></Alert> : null}
    {fields.map(({ name, label, placeholder, type }) => <Stack key={name} gap="sm"><Label>{label}</Label><Input type={type} placeholder={placeholder} value={model.formData[name]} onChangeText={(text) => model.changeField(name, text)} disabled={model.isLoading} /></Stack>)}
    <Text size="sm" tone="muted">Preencha o CPF ou CNPJ.</Text>
    <Label>Senha</Label>
    <Input type={model.showPassword ? "text" : "password"} placeholder="Digite sua senha" value={model.formData.password} onChangeText={(text) => model.changeField("password", text)} disabled={model.isLoading} />
    <Button variant="ghost" disabled={model.isLoading} onClick={() => model.setShowPassword(!model.showPassword)}>{model.showPassword ? "Ocultar senha" : "Mostrar senha"}</Button>
    <Label>Confirmar Senha</Label>
    <Input type={model.showConfirmPassword ? "text" : "password"} placeholder="Confirme sua senha" value={model.formData.confirmPassword} onChangeText={(text) => model.changeField("confirmPassword", text)} disabled={model.isLoading} />
    <Button variant="ghost" disabled={model.isLoading} onClick={() => model.setShowConfirmPassword(!model.showConfirmPassword)}>{model.showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}</Button>
    <Button disabled={model.isLoading} onClick={() => { void model.submit(); }}>{model.isLoading ? "Criando Conta..." : "Criar Conta"}</Button>
          {(props.socialProviders ?? ["google", "facebook"]).map((provider) => <Button key={provider} variant="outline" disabled={model.isLoading} onClick={() => { void model.handleSocialLogin(provider); }}>{provider === "google" ? "Google" : "Facebook"}</Button>)}
    <Link href={registrationLoginUrl(props.callbackUrl ?? null)}>Já tem uma conta? Faça login</Link>
  </Stack></Card></Stack>;
}
