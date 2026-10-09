export interface QuoteRequestAddress {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface QuoteRequestForm {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cnpj: string;
  cep: string;
  company: string;
  message: string;
  deliveryType?: "DELIVERY" | "PICKUP";
  deliveryAddress?: QuoteRequestAddress;
}

export interface QuoteRequestItemInput {
  equipmentId: string;
  quantity: number;
  days: number;
  startDate?: Date | string;
  endDate?: Date | string;
  includeWeekends?: boolean;
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toIso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

export function buildQuoteRequestBody(form: QuoteRequestForm, items: QuoteRequestItemInput[]) {
  return {
    customerName: form.name,
    customerEmail: form.email,
    customerPhone: form.phone,
    cpf: blankToUndefined(form.cpf),
    cnpj: blankToUndefined(form.cnpj),
    cep: blankToUndefined(form.cep),
    customerCompany: blankToUndefined(form.company),
    message: blankToUndefined(form.message),
    deliveryType: form.deliveryType,
    deliveryAddress: form.deliveryAddress
      ? {
          cep: form.deliveryAddress.cep,
          logradouro: form.deliveryAddress.logradouro,
          numero: form.deliveryAddress.numero,
          complemento: form.deliveryAddress.complemento,
          bairro: form.deliveryAddress.bairro,
          cidade: form.deliveryAddress.cidade,
          estado: form.deliveryAddress.estado,
        }
      : undefined,
    items: items.map((eq) => {
      const days = Number(eq.days) || 1;
      const quantity = Number(eq.quantity) || 1;
      return {
        equipmentId: eq.equipmentId,
        quantity,
        days,
        startDate: toIso(eq.startDate),
        endDate: toIso(eq.endDate),
        includeWeekends: eq.includeWeekends || false,
      };
    }),
  };
}

export function listMissingQuoteFields(form: { name: string; phone: string; email: string }): {
  labels: string[];
  ids: string[];
} {
  const labels: string[] = [];
  const ids: string[] = [];

  if (!form.name || !form.name.trim()) {
    labels.push("Nome Completo");
    ids.push("name");
  }

  if (!form.phone || !form.phone.trim()) {
    labels.push("Telefone");
    ids.push("phone");
  }

  if (!form.email || !form.email.trim()) {
    labels.push("E-mail");
    ids.push("email");
  }

  return { labels, ids };
}

export function missingQuoteFieldsMessage(labels: string[]): string {
  return `Por favor, preencha os seguintes campos antes de enviar: ${labels.join(", ")}.`;
}

export const QUOTE_DOCUMENT_REQUIRED = "Por favor, preencha pelo menos o CPF ou CNPJ.";
export const QUOTE_CPF_INVALID = "CPF inválido. Por favor, verifique o número.";
export const QUOTE_CNPJ_INVALID = "CNPJ inválido. Por favor, verifique o número.";
export const QUOTE_COMPANY_REQUIRED = "Empresa é obrigatória quando CNPJ é informado.";
export const QUOTE_PERIOD_REQUIRED =
  "Alguns equipamentos não têm período de locação definido. Por favor, defina o número de dias para cada equipamento.";
export const QUOTE_DELIVERY_TYPE_REQUIRED =
  "Por favor, selecione o tipo de entrega (Retirada em Loja ou Entrega no Endereço) antes de enviar a solicitação.";
export const QUOTE_ADDRESS_REQUIRED =
  "Por favor, preencha todos os campos do endereço de entrega (CEP, Logradouro, Número, Bairro, Cidade e Estado).";

export type QuoteSubmitIssue =
  | { kind: "document-missing" }
  | { kind: "cpf-invalid" }
  | { kind: "cnpj-invalid" }
  | { kind: "company-required" }
  | { kind: "period-missing" }
  | { kind: "delivery-type" }
  | { kind: "address-missing" }
  | { kind: "address-fields"; labels: string[]; ids: string[] };

export function missingAddressFieldsMessage(labels: string[]): string {
  return `Por favor, preencha os seguintes campos do endereço antes de enviar: ${labels.join(", ")}.`;
}

export function assessQuoteSubmit(
  form: QuoteRequestForm,
  items: Array<{ days?: number }>,
  validators: { cpf: (value: string) => boolean; cnpj: (value: string) => boolean },
): QuoteSubmitIssue | null {
  if (!form.cpf.trim() && !form.cnpj.trim()) return { kind: "document-missing" };
  if (form.cpf.trim() && !validators.cpf(form.cpf)) return { kind: "cpf-invalid" };
  if (form.cnpj.trim() && !validators.cnpj(form.cnpj)) return { kind: "cnpj-invalid" };
  if (form.cnpj.trim() && !form.company.trim()) return { kind: "company-required" };
  if (items.some((eq) => !eq.days || eq.days < 1)) return { kind: "period-missing" };
  if (!form.deliveryType) return { kind: "delivery-type" };

  if (form.deliveryType === "DELIVERY") {
    if (!form.deliveryAddress) return { kind: "address-missing" };

    const labels: string[] = [];
    const ids: string[] = [];
    const address = form.deliveryAddress;
    if (!address.cep || !address.cep.trim()) {
      labels.push("CEP");
      ids.push("cep");
    }
    if (!address.logradouro || !address.logradouro.trim()) {
      labels.push("Logradouro");
      ids.push("logradouro");
    }
    if (!address.numero || !address.numero.trim()) {
      labels.push("Número");
      ids.push("numero");
    }
    if (!address.bairro || !address.bairro.trim()) {
      labels.push("Bairro");
      ids.push("bairro");
    }
    if (!address.cidade || !address.cidade.trim()) {
      labels.push("Cidade");
      ids.push("cidade");
    }
    if (!address.estado || !address.estado.trim()) {
      labels.push("Estado");
      ids.push("estado");
    }
    if (labels.length > 0) return { kind: "address-fields", labels, ids };
  }

  return null;
}

export const QUOTE_UNAVAILABLE =
  "Um ou mais equipamentos não estão disponíveis nas datas selecionadas.";

export function findItemNeedingWeekendConfirmation<
  T extends {
    startDate?: Date | string;
    endDate?: Date | string;
    includeWeekendsConfirmed?: boolean;
  },
>(items: T[]): T | undefined {
  return items.find((eq) => {
    const hasNoDates = !eq.startDate || !eq.endDate;
    const needsConfirmation = !eq.includeWeekendsConfirmed;
    return hasNoDates && needsConfirmation;
  });
}

export function weekendConfirmationMessage(equipmentName: string): string {
  return `Precisamos confirmar se o uso aos finais de semana está incluído para "${equipmentName}".`;
}

export function isAddressComplete(address: {
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}): boolean {
  return !!(address.cep && address.logradouro && address.numero && address.bairro && address.cidade && address.estado);
}

export interface SavedQuoteAddress {
  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  complement?: string | null;
}

export function isAddressDifferent(
  formAddress: QuoteRequestAddress,
  savedAddress: SavedQuoteAddress,
): boolean {
  const formCep = formAddress.cep.replace(/\D/g, "");
  const savedCep = savedAddress.zipCode.replace(/\D/g, "");
  const normalize = (str: string) => str.trim().toLowerCase();

  return (
    formCep !== savedCep ||
    normalize(formAddress.logradouro) !== normalize(savedAddress.street) ||
    normalize(formAddress.numero) !== normalize(savedAddress.number) ||
    normalize(formAddress.bairro) !== normalize(savedAddress.neighborhood) ||
    normalize(formAddress.cidade) !== normalize(savedAddress.city) ||
    normalize(formAddress.estado) !== normalize(savedAddress.state) ||
    normalize(formAddress.complemento || "") !== normalize(savedAddress.complement || "")
  );
}

export function isDocumentValueNew(formValue: string | undefined, savedValue: string | undefined): boolean {
  if (!formValue || !formValue.trim()) return false;
  if (!savedValue) return true;
  const normalizedForm = formValue.replace(/\D/g, "").toLowerCase();
  const normalizedSaved = savedValue.replace(/\D/g, "").toLowerCase();
  return normalizedForm !== normalizedSaved;
}

export function collectNewCustomerInfo(
  form: { phone?: string; cpf?: string; cnpj?: string; company?: string },
  saved: { phone?: string; cpf?: string; cnpj?: string; company?: string },
): { phone?: string; cpf?: string; cnpj?: string; company?: string } {
  const newInfo: { phone?: string; cpf?: string; cnpj?: string; company?: string } = {};

  if (isDocumentValueNew(form.phone, saved.phone)) newInfo.phone = form.phone;
  if (isDocumentValueNew(form.cpf, saved.cpf)) newInfo.cpf = form.cpf;
  if (isDocumentValueNew(form.cnpj, saved.cnpj)) newInfo.cnpj = form.cnpj;
  if (form.company?.trim() && form.company.trim() !== saved.company?.trim()) {
    newInfo.company = form.company;
  }

  return newInfo;
}
