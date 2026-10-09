# Isolamento das operações e integrações legadas

Causa: drivers/logística/manutenção/auditoria autorizavam User.role global e
consultavam modelos sem tenant. Helpers de manutenção alteravam disponibilidade
fora da transação da manutenção. Integrações usavam credenciais globais e podiam
retornar IDs/preços fictícios na ausência de serviço externo.

Solução:18 métodos operacionais e seus helpers passaram a principal membership,
filtros tenant e transações RLS. Referências de logística são validadas antes de
escrever e contatos vêm do ClientProfile local. Manutenção usa o mesmo lock das
locações, com atualização de equipamento e manutenção atômicas. Integrações
falham explicitamente quando indisponíveis; Merchant aguarda adapter por conta.

Detalhes, arquivos, comandos e limites:
[operações por locadora](../features/operations-tenancy.md). Regressão:58 casos
de handlers mockados e8 casos com PostgreSQL descartável; nenhuma chamada real a
provedores foi executada.
