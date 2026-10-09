import { useState } from "react";
import { View, Text } from "react-native";
import { space } from "@gb-locacoes/design-tokens";
import type { AddressData, AddressFormProps } from "../contract/address-form";
import { Input } from "./Input.native";

const fields: Array<{ key: keyof AddressData; label: string; placeholder: string }> = [
  { key: "cep", label: "CEP", placeholder: "00000-000" },
  { key: "logradouro", label: "Logradouro", placeholder: "Rua, Avenida, etc." },
  { key: "numero", label: "Número", placeholder: "123" },
  { key: "complemento", label: "Complemento", placeholder: "Apto, Bloco, etc." },
  { key: "bairro", label: "Bairro", placeholder: "Bairro" },
  { key: "cidade", label: "Cidade", placeholder: "Cidade" },
  { key: "estado", label: "Estado", placeholder: "RS" },
];

export function AddressForm({ value, onChange, lookupAddress, disabled = false, required = false }: AddressFormProps) {
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const changeField = async (key: keyof AddressData, input: string) => {
    const digits = input.replace(/\D/g, "").slice(0, 8);
    const text = key === "cep" ? (digits.length > 5 ? digits.slice(0, 5) + "-" + digits.slice(5) : digits) : key === "estado" ? input.slice(0, 2).toUpperCase() : input;
    const next = { ...value, [key]: text };
    onChange(next);
    if (key !== "cep" || digits.length !== 8) return;
    setLoading(true);
    setLookupError(null);
    try {
      const address = await lookupAddress(text);
      if (address) onChange({ ...next, logradouro: address.logradouro, complemento: address.complemento, bairro: address.bairro, cidade: address.localidade, estado: address.uf });
    } catch {
      setLookupError("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={{ gap: space.md }}>
      {lookupError ? <Text accessibilityRole="alert">{lookupError}</Text> : null}
      {fields.map(({ key, label, placeholder }) => (
        <View key={key} style={{ gap: space.xs }}>
          <Text>{label}{required && key !== "complemento" ? " *" : ""}</Text>
          <Input value={value[key]} placeholder={placeholder} disabled={disabled || (loading && key === "cep")} onChangeText={(text) => { void changeField(key, text); }} />
        </View>
      ))}
    </View>
  );
}
