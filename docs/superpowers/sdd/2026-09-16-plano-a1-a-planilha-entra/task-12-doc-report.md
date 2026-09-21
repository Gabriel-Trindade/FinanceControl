# Tarefa 12 — Documentação da Importação · Relatório

## O que foi documentado

Adicionado ao `README.md` uma nova seção "Importação da planilha" com:

1. **Visão geral:** O que é, onde fica (`/importar`), e que o arquivo é lido no aparelho, nunca sobe para o servidor.

2. **Como importar:** Passo a passo das 4 etapas (escolher, conferir, gravar, relatório).

3. **As quatro etapas:** Descrição detalhada de cada uma:
   - Etapa 1: Seleção de arquivo e painel de desfazer
   - Etapa 2: Resumo numérico (linhas lidas, novas, já importadas, com problema) + listas de problemas e avisos
   - Etapa 3: Barra de progresso por lote
   - Etapa 4: Relatório com o que entrou e atalho para a lista

4. **Desfazer uma importação:** Onde fica, como funciona (digitação de "APAGAR"), e esclarecimento de que apaga só lançamentos com `fonte = 'planilha'`.

5. **Testar no celular:** Comando `npm run dev -- --hostname 0.0.0.0` com explicação de como acessar pelo IP na mesma rede Wi-Fi.

## Contradições encontradas

**Nenhuma.** O código implementado em `src/app/(app)/importar/componentes.tsx` e `assistente.tsx` é fiel à spec do design (`2026-09-16-planilha-primeiro-design.md`), e a documentação reflete o comportamento real.

## Verificação

- `npm test`: 324 testes passaram
- `npm run lint`: sem erros
- `npm run typecheck`: tipos OK
- Commit: `docs: documenta funcionalidade de importação de planilha`
