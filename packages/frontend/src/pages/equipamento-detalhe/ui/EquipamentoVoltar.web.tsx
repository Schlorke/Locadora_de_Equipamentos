"use client";

import { ArrowLeft } from "lucide-react";
import { Link } from '@gb-locacoes/ui';

export function EquipamentoVoltar() {
  return (
    <Link
      href="/equipamentos"
      className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors duration-200 font-medium"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar aos Equipamentos
    </Link>
  );
}
