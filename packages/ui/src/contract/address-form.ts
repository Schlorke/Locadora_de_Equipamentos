export interface AddressData {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface AddressLookupResult {
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export interface AddressFormProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
  lookupAddress: (cep: string) => Promise<AddressLookupResult | null>;
  disabled?: boolean;
  required?: boolean;
}
