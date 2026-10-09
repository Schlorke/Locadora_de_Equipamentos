export const avisoInicio = {
  message: "Selecione a data de início",
  description: "Clique no calendário para escolher quando a locação começa",
  position: "top-right" as const,
  duration: 8000,
};

export const avisoFim = {
  message: "Agora selecione a data final",
  description: "Clique novamente no calendário para escolher quando a locação termina",
  position: "top-right" as const,
  duration: 8000,
};

export function avisoSucesso(selectedDays: number) {
  return {
    message: "Datas selecionadas com sucesso!",
    description: `Período de ${selectedDays} ${selectedDays === 1 ? "dia" : "dias"} configurado. Agora você pode escolher o período de locação.`,
    position: "top-right" as const,
    duration: 8000,
  };
}

export const avisoLogin = {
  message: "Login necessário",
  description:
    "Para solicitar um orçamento, você precisa estar logado. Faça login ou cadastre-se para continuar.",
  position: "top-center" as const,
  duration: 12000,
};
