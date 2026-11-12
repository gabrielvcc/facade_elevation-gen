# Notas de Atualização da Versão 1.1.0 - 12/11/2026

## Novas Funcionalidades
1. **Canto**
   - Adicionado modo para marcar cantos nos montantes internos, entre as colunas, sem ocupar um quadro.
   - É possível adicionar ou remover vários cantos na mesma edição para representar fachadas com mudanças de direção.
   - Os cantos aparecem no desenho com o montante destacado e são exportados com a indicação `CANTO` e um marcador em V.

2. **Infinidade nas laterais da fachada**
   - Adicionado modo para representar a continuidade da fachada nas extremidades esquerda e direita.
   - Ao selecionar um quadro de uma das colunas extremas, o corte é aplicado em toda a altura da fachada.
   - A barra diagonal corta visualmente os módulos e o contorno externo, ocultando o trecho que ultrapassa o corte sem excluir os componentes do projeto.
   - O corte também alcança a cota horizontal `L`, tanto na apresentação quanto nas cotas detalhadas.
   - É possível adicionar ou remover as marcações durante a edição.

3. **Componente ACM**
   - Adicionado componente que preenche o quadro com cinza claro para representar uma chapa de ACM.
   - Disponível na barra lateral e no menu `+` de cada quadro, com inserção individual e opção de exclusão.
   - O preenchimento aparece no editor e no PNG, preservando as linhas pretas que delimitam o quadro.

## Ajustes
1. **Foco visual no modo de edição**
   - O restante da interface fica desfocado durante a inserção, mantendo nítidos o componente selecionado, o grid e seus rótulos de linhas e colunas.
   - O aviso de inserção saiu do topo da barra lateral e passou para o canto inferior esquerdo da área do desenho, sem deslocar os componentes.
   - O cancelamento usa um botão circular vermelho com X; Canto e Infinidade também possuem um botão circular verde para finalizar.
   - Nesses dois modos, finalizar mantém as alterações, enquanto cancelar ou pressionar `Esc` restaura as marcações anteriores à sessão de edição.

2. **Configuração da Porta de Giro**
   - O modal central foi substituído por um balão compacto acima do aviso de inserção, seguindo o mesmo padrão visual.
   - Mantidas as opções de um ou dois módulos, abertura à esquerda ou à direita e configuração com ou sem travessa.
   - Mantida a restrição de dois módulos quando não existe um quadro livre acima.
   - Os caminhos pela barra lateral e pelo menu `+` usam o mesmo fluxo de configuração e confirmação.
   - Enquanto as opções estão abertas, novos cliques de inserção no grid ficam bloqueados e o X do aviso inferior fica oculto para evitar dois botões de cancelar.

3. **Rolagem da lista de componentes**
   - Adicionada rolagem independente na barra lateral, mantendo o título `Componentes` fixo.
   - Os ícones mantêm seu tamanho, sem encolher para caber na tela.
   - As descrições ao passar o mouse foram posicionadas dentro dos botões para não serem cortadas pela área de rolagem.

4. **Ícones e marcações**
   - O ícone do Canto usa a indicação `CANTO` sobre um V pequeno, dentro do mesmo botão pontilhado dos demais componentes.
   - O ícone da Infinidade passou a usar um símbolo de infinito com curvas suaves, levemente quadrado e em tamanho reduzido.
   - A diagonal de infinidade usa o laranja do aplicativo e foi reposicionada mais para dentro do módulo, com os lados esquerdo e direito espelhados.
   - Ajustado o afastamento do marcador de canto no PNG para não sobrepor o contorno externo da fachada nem ficar excessivamente distante dele.

---

# Notas de Atualização da Versão 1.0.5 - 31/07/2026

## Novas Funcionalidades
1. **Inserção de linhas e colunas no meio do croqui**
   - Adicionados botões de inserção nos rótulos do grid para criar colunas entre letras e linhas entre números.
   - Componentes já posicionados são deslocados automaticamente quando uma nova linha ou coluna é inserida.

2. **Exclusão de linhas e colunas**
   - Adicionados botões para excluir qualquer linha ou coluna do croqui.
   - Ao excluir, os módulos seguintes são reorganizados automaticamente.

3. **Medidas em centímetros**
   - As larguras das colunas e alturas das linhas agora são exibidas em `cm`.
   - Os rótulos do grid mostram a identificação e a medida, como `A / 100cm` e `1 / 100cm`.
   - O limite máximo de tamanho dos quadros foi aumentado para `400cm`.

4. **Aplicação de medida em lote**
   - Adicionado controle para aplicar uma medida padrão em todas as colunas, todas as linhas ou em tudo.

5. **Exportação com cotas detalhadas**
   - A pré-visualização do croqui agora permite escolher entre `Apresentação` e `Detalhadas`.
   - O modo `Apresentação` mantém as cotas gerais `L` e `H`.
   - O modo `Detalhadas` gera cotas por módulo e cotas totais no formato `L: 500cm` e `H: 300cm`.
   - A imagem de pré-visualização é atualizada ao trocar o tipo de cota.

6. **Novo modo de inserção pela barra lateral**
   - Os componentes da barra lateral agora são inseridos por clique, sem precisar arrastar.
   - `Maxim-ar` e `Veneziana` permitem escolher entre inserir em um quadro específico ou preencher uma linha inteira.

7. **Inserção de linha inteira pelo quadro**
   - Ao clicar no `+` de um quadro da coluna A e escolher `Maxim-ar` ou `Veneziana`, agora é possível inserir o componente somente naquele quadro ou preencher a linha inteira.
   - A opção de linha inteira fica restrita ao quadro mais à esquerda da linha.

## Correções
1. **Reposicionamento ao inserir no meio**
   - Corrigida a limitação em que novas linhas e colunas só podiam ser adicionadas no final do croqui.

## Ajustes
1. **Topbar**
   - Botões e campos da barra superior foram compactados para melhor encaixe.

2. **Interface dos componentes**
   - Adicionado destaque visual para o componente selecionado e para os quadros disponíveis no modo de inserção.
   - Adicionado botão para cancelar o modo de inserção.

3. **Edição de tamanho dos quadros**
   - Adicionado botão de modificar nos rótulos de linhas e colunas para deixar mais claro onde alterar largura e altura.
   - O clique direto no rótulo continua funcionando para editar o tamanho.

---

# Notas de Atualização da Versão 1.0.4 - 09/07/2026

## Novas Funcionalidades
1. **Identidade na topbar**
   - Adicionada a logo e o nome `Criador de Croquis` no início da barra superior.


---

# Notas de Atualização da Versão 1.0.3 - 19/09/2025

## Novas Funcionalidades
1. **Menu `+` melhorado**
   - Melhorada a aparência do menu `+`, deixando-o no mesmo padrão visual da barra lateral de componentes.

2. **Menu de componentes melhorado**
   - Adicionada a descrição do item ao lado da imagem do componente.

## Correções
1. **Tamanho padrão de novas linhas**
   - Corrigido o problema em que novas linhas eram inseridas com `98px` por padrão.


---

# Notas de Atualização da Versão 1.0.2 - 10/09/2025

## Novas Funcionalidades
1. **Componente Porta de Giro**
   - Adicionada a opção de criar portas de 1 ou 2 módulos de altura.
   - Implementada a opção de porta com ou sem travessa para ambos os tamanhos.

2. **Componente Veneziana adaptativo**
   - O desenho da veneziana agora se adapta a qualquer altura de módulo definida pelo usuário.

## Correções
1. **Posicionamento e adaptação dos desenhos**
   - Corrigidos problemas de posicionamento e adaptação dos desenhos em relação aos tamanhos dos quadros.

## Ajustes
1. **Estrutura dos quadros**
   - Reformulada a estrutura de inserção de quadros. As linhas que dividem os quadros agora funcionam como zonas mortas.

---

# Notas de Atualização da Versão 1.0.1 - 05/08/2025

Aqui estão as principais mudanças e melhorias implementadas nesta versão:

## Novas Funcionalidades
1. **Lançamento inicial**
   - Primeira versão do aplicativo.
