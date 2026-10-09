import { describe, expect, it } from "vitest";
import {
  QUOTE_ADDRESS_REQUIRED,
  QUOTE_CNPJ_INVALID,
  QUOTE_COMPANY_REQUIRED,
  QUOTE_CPF_INVALID,
  QUOTE_DELIVERY_TYPE_REQUIRED,
  QUOTE_DOCUMENT_REQUIRED,
  QUOTE_PERIOD_REQUIRED,
  QUOTE_UNAVAILABLE,
  assessQuoteSubmit,
  buildQuoteRequestBody,
  findItemNeedingWeekendConfirmation,
  collectNewCustomerInfo,
  isAddressComplete,
  isAddressDifferent,
  isDocumentValueNew,
  listMissingQuoteFields,
  missingAddressFieldsMessage,
  missingQuoteFieldsMessage,
  weekendConfirmationMessage,
} from "./envio";

const emptyForm = {
  name: "Ana",
  email: "ana@gb.com",
  phone: "51999999999",
  cpf: "   ",
  cnpj: "",
  cep: " 90000-000 ",
  company: "",
  message: "  preciso ",
};

describe("corpo do pedido de orçamento", () => {
  it("omite textos em branco e mantém o recado aparado", () => {
    const body = buildQuoteRequestBody(emptyForm, []);
    expect(body.customerName).toBe("Ana");
    expect(body.cpf).toBeUndefined();
    expect(body.cnpj).toBeUndefined();
    expect(body.customerCompany).toBeUndefined();
    expect(body.cep).toBe("90000-000");
    expect(body.message).toBe("preciso");
    expect(body.deliveryAddress).toBeUndefined();
  });

  it("copia só o endereço de entrega e os itens com dias mínimos", () => {
    const start = new Date("2026-01-05T00:00:00.000Z");
    const body = buildQuoteRequestBody(
      {
        ...emptyForm,
        deliveryType: "DELIVERY",
        deliveryAddress: {
          cep: "90000-000",
          logradouro: "Rua A",
          numero: "10",
          complemento: "Sala 1",
          bairro: "Centro",
          cidade: "Porto Alegre",
          estado: "RS",
        },
      },
      [
        {
          equipmentId: "eq-1",
          quantity: 0,
          days: 0,
          startDate: start,
          includeWeekends: undefined,
        },
      ],
    );

    expect(body.deliveryType).toBe("DELIVERY");
    expect(body.deliveryAddress).toEqual({
      cep: "90000-000",
      logradouro: "Rua A",
      numero: "10",
      complemento: "Sala 1",
      bairro: "Centro",
      cidade: "Porto Alegre",
      estado: "RS",
    });
    expect(body.items[0]).toEqual({
      equipmentId: "eq-1",
      quantity: 1,
      days: 1,
      startDate: "2026-01-05T00:00:00.000Z",
      endDate: undefined,
      includeWeekends: false,
    });
  });

  it("lista Nome Completo, Telefone e E-mail quando vazios", () => {
    const missing = listMissingQuoteFields({ name: " ", phone: "", email: "" });
    expect(missing.labels).toEqual(["Nome Completo", "Telefone", "E-mail"]);
    expect(missing.ids).toEqual(["name", "phone", "email"]);
    expect(missingQuoteFieldsMessage(missing.labels)).toBe(
      "Por favor, preencha os seguintes campos antes de enviar: Nome Completo, Telefone, E-mail.",
    );
  });

  it("pede documento, recusa CPF inválido e exige empresa com CNPJ", () => {
    const always = { cpf: () => true, cnpj: () => true };
    expect(assessQuoteSubmit({ ...emptyForm, cpf: " ", cnpj: "" }, [{ days: 1 }], always)?.kind).toBe(
      "document-missing",
    );
    expect(QUOTE_DOCUMENT_REQUIRED).toBe("Por favor, preencha pelo menos o CPF ou CNPJ.");
    expect(
      assessQuoteSubmit({ ...emptyForm, cpf: "123" }, [{ days: 1 }], { cpf: () => false, cnpj: () => true })?.kind,
    ).toBe("cpf-invalid");
    expect(QUOTE_CPF_INVALID).toBe("CPF inválido. Por favor, verifique o número.");
    expect(
      assessQuoteSubmit({ ...emptyForm, cpf: "", cnpj: "1" }, [{ days: 1 }], {
        cpf: () => true,
        cnpj: () => false,
      })?.kind,
    ).toBe("cnpj-invalid");
    expect(QUOTE_CNPJ_INVALID).toBe("CNPJ inválido. Por favor, verifique o número.");
    expect(
      assessQuoteSubmit({ ...emptyForm, cpf: "", cnpj: "1", company: " " }, [{ days: 1 }], always)?.kind,
    ).toBe("company-required");
    expect(QUOTE_COMPANY_REQUIRED).toBe("Empresa é obrigatória quando CNPJ é informado.");
  });

  it("pede período, tipo de entrega e os campos do endereço", () => {
    const always = { cpf: () => true, cnpj: () => true };
    expect(assessQuoteSubmit({ ...emptyForm, cpf: "1" }, [{ days: 0 }], always)?.kind).toBe("period-missing");
    expect(QUOTE_PERIOD_REQUIRED).toContain("número de dias");
    expect(assessQuoteSubmit({ ...emptyForm, cpf: "1" }, [{ days: 2 }], always)?.kind).toBe("delivery-type");
    expect(QUOTE_DELIVERY_TYPE_REQUIRED).toContain("Retirada em Loja");
    expect(
      assessQuoteSubmit({ ...emptyForm, cpf: "1", deliveryType: "DELIVERY" }, [{ days: 2 }], always)?.kind,
    ).toBe("address-missing");
    expect(QUOTE_ADDRESS_REQUIRED).toContain("CEP, Logradouro, Número, Bairro, Cidade e Estado");
    const fields = assessQuoteSubmit(
      {
        ...emptyForm,
        cpf: "1",
        deliveryType: "DELIVERY",
        deliveryAddress: {
          cep: " ",
          logradouro: "",
          numero: "10",
          bairro: "Centro",
          cidade: "Porto Alegre",
          estado: "RS",
        },
      },
      [{ days: 2 }],
      always,
    );
    expect(fields).toEqual({ kind: "address-fields", labels: ["CEP", "Logradouro"], ids: ["cep", "logradouro"] });
    if (fields?.kind === "address-fields") {
      expect(missingAddressFieldsMessage(fields.labels)).toBe(
        "Por favor, preencha os seguintes campos do endereço antes de enviar: CEP, Logradouro.",
      );
    }
    expect(
      assessQuoteSubmit({ ...emptyForm, cpf: "1", deliveryType: "PICKUP" }, [{ days: 2 }], always),
    ).toBeNull();
  });
});

describe("confirmação de fim de semana e endereço salvo", () => {
  it("pede confirmação só do primeiro item sem datas e sem confirmação", () => {
    const item = findItemNeedingWeekendConfirmation([
      { equipmentId: "a", equipmentName: "Betoneira", startDate: new Date(), endDate: new Date(), includeWeekendsConfirmed: false },
      { equipmentId: "b", equipmentName: "Andaime", includeWeekendsConfirmed: false },
      { equipmentId: "c", equipmentName: "Compressor", includeWeekendsConfirmed: true },
    ]);
    expect(item?.equipmentId).toBe("b");
    expect(weekendConfirmationMessage("Andaime")).toBe(
      'Precisamos confirmar se o uso aos finais de semana está incluído para "Andaime".',
    );
    expect(QUOTE_UNAVAILABLE).toBe("Um ou mais equipamentos não estão disponíveis nas datas selecionadas.");
  });

  it("trata CEP formatado como igual e ignora maiúsculas", () => {
    const form = {
      cep: "90000-000",
      logradouro: " Rua A ",
      numero: "10",
      complemento: "",
      bairro: "Centro",
      cidade: "Porto Alegre",
      estado: "rs",
    };
    expect(isAddressComplete(form)).toBe(true);
    expect(isAddressComplete({ ...form, numero: "" })).toBe(false);
    expect(
      isAddressDifferent(form, {
        zipCode: "90000000",
        street: "rua a",
        number: "10",
        neighborhood: "centro",
        city: "porto alegre",
        state: "RS",
        complement: null,
      }),
    ).toBe(false);
    expect(
      isAddressDifferent(form, {
        zipCode: "90000000",
        street: "rua b",
        number: "10",
        neighborhood: "centro",
        city: "porto alegre",
        state: "RS",
        complement: null,
      }),
    ).toBe(true);
  });

  it("grava telefone e CPF só quando os dígitos mudam e mantém a empresa original", () => {
    expect(isDocumentValueNew("  ", "51")).toBe(false);
    expect(isDocumentValueNew("(51) 99999-9999", undefined)).toBe(true);
    expect(isDocumentValueNew("(51) 99999-9999", "51999999999")).toBe(false);
    expect(
      collectNewCustomerInfo(
        { phone: "(51) 98888-7777", cpf: "123", cnpj: "", company: " GB " },
        { phone: "51988887777", cpf: "999", company: "gb" },
      ),
    ).toEqual({ cpf: "123", company: " GB " });
  });
});
