"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import type { AddressFormProps } from "../contract/address-form";
export type { AddressData } from "../contract/address-form";
import { formatAddressCep } from "./address-cep";
import { Input } from "./Input.web";
import { Label } from "./Label.web";

export function AddressForm({ value, onChange, lookupAddress, disabled = false, required = false }: AddressFormProps) {
  const [isLoadingCEP, setIsLoadingCEP] = React.useState(false);

  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAddressCep(e.target.value);
    const newAddress = { ...value, cep: formatted };
    onChange(newAddress);

    const cleanCEP = formatted.replace(/\D/g, "");
    if (cleanCEP.length === 8) {
      setIsLoadingCEP(true);
      try {
        const addressData = await lookupAddress(formatted);
        if (addressData) {
          onChange({
            ...newAddress,
            logradouro: addressData.logradouro,
            bairro: addressData.bairro,
            cidade: addressData.localidade,
            estado: addressData.uf,
            complemento: addressData.complemento,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setIsLoadingCEP(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <Label htmlFor="cep">
            CEP {required && <span className="text-red-500">*</span>}
          </Label>
          <div className="relative">
            <Input
              id="cep"
              value={value.cep}
              onChange={handleCEPChange}
              placeholder="00000-000"
              maxLength={9}
              disabled={disabled || isLoadingCEP}
              className="mt-1"
              required={required}
            />
            {isLoadingCEP && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="logradouro">
            Logradouro {required && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="logradouro"
            value={value.logradouro}
            onChange={(e) => onChange({ ...value, logradouro: e.target.value })}
            placeholder="Rua, Avenida, etc."
            disabled={disabled}
            className="mt-1"
            required={required}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="numero">
            Número {required && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="numero"
            value={value.numero}
            onChange={(e) => onChange({ ...value, numero: e.target.value })}
            placeholder="123"
            disabled={disabled}
            className="mt-1"
            required={required}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="complemento">Complemento</Label>
          <Input
            id="complemento"
            value={value.complemento}
            onChange={(e) => onChange({ ...value, complemento: e.target.value })}
            placeholder="Apto, Bloco, etc."
            disabled={disabled}
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="bairro">
            Bairro {required && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="bairro"
            value={value.bairro}
            onChange={(e) => onChange({ ...value, bairro: e.target.value })}
            placeholder="Bairro"
            disabled={disabled}
            className="mt-1"
            required={required}
          />
        </div>
        <div>
          <Label htmlFor="cidade">
            Cidade {required && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="cidade"
            value={value.cidade}
            onChange={(e) => onChange({ ...value, cidade: e.target.value })}
            placeholder="Cidade"
            disabled={disabled}
            className="mt-1"
            required={required}
          />
        </div>
        <div>
          <Label htmlFor="estado">
            Estado {required && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="estado"
            value={value.estado}
            onChange={(e) => onChange({ ...value, estado: e.target.value })}
            placeholder="RS"
            maxLength={2}
            disabled={disabled}
            className="mt-1 uppercase"
            required={required}
          />
        </div>
      </div>
    </div>
  );
}
