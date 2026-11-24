# Notas de Atualização da Versão 1.1.3 - 24/11/2026

## Novas Funcionalidades
1. **Canto nas extremidades da fachada**
   - O componente `Canto` pode ser aplicado nos montantes externos esquerdo e direito, além dos intermediários.
   - Os cantos externos permanecem nas respectivas extremidades ao inserir ou excluir colunas.

---

# Notas de Atualização da Versão 1.1.2 - 18/11/2026

## Novas Funcionalidades
1. **Componente Requadro**
   - Adicionado componente para representar um vão vazio na fachada, sem definir porta, janela ou outro preenchimento.
   - Disponível na barra lateral e no menu `+` dos quadros, com configuração no balão superior esquerdo e confirmação antes de inserir.
   - O quadro escolhido é a base inferior esquerda; o vão pode crescer para cima e para a direita, sempre formando um retângulo.
   - As divisões internas são removidas, mantendo os limites do vão. Ao alcançar a base ou o topo da fachada, o trecho correspondente do marco externo também é aberto.
   - O resultado aparece no editor e no PNG, incluindo os modos de cotas e a exportação com tamanho fixo.

2. **Seleção do Requadro diretamente no desenho**
   - Além do mini grid do balão, é possível clicar nos quadros vizinhos da base para escolher o tamanho do vão.
   - O seletor e o destaque laranja do desenho permanecem sincronizados.
   - A seleção troca de tamanho sem acumular áreas em formato de L.
   - Cliques além do limite permitido são ignorados sem encerrar a seleção; clicar fora do grid continua cancelando a edição.
   - Expansões que ultrapassem a fachada ou incluam componentes já posicionados ficam bloqueadas.

## Ajustes
2. **Ocupação e exclusão do vão**
   - O Requadro é tratado como um único componente, mesmo quando ocupa vários módulos.
   - Excluir o componente libera toda a área ocupada. Excluir uma linha ou coluna que atravesse o vão remove o Requadro inteiro, sem deixar quadros bloqueados.
   - O desenho acompanha as medidas individuais das linhas e colunas e o reposicionamento da base ao inserir módulos antes dela.
   - Adicionado `Requadro` à contagem de componentes utilizados na visualização, contando cada vão uma única vez.

3. **Menu de componentes**
   - Incluído o ícone do Requadro no padrão visual dos demais componentes.
   - O menu `+` foi ajustado para acomodar o novo componente e permanecer dentro dos limites da tela, inclusive em dispositivos menores.

---

# Notas de Atualização da Versão 1.1.1 - 13/11/2026

## Novas Funcionalidades
1. **Nova tela de visualização e exportação**
   - A geração do croqui agora abre uma tela própria, substituindo a antiga janela central.
   - Adicionada transição horizontal entre o editor e a visualização, com botão para retornar à edição sem perder o desenho.
   - O painel de exportação reúne nome do arquivo, cotas, tamanho da imagem e informações da fachada.
   - Disponíveis três modos de cotas: `Sem cotas`, `Apresentação` com `L/H` e `Com medidas`, com valores por módulo e totais.
   - Exibidos largura total, altura total, modulação, resolução em pixels e peso do arquivo PNG.
   - Adicionados estados de preparação e erro, com opção de tentar gerar novamente.
   - O download mantém a visualização aberta, e o nome personalizado é preservado ao trocar as opções de exportação ou voltar à visualização.
   - Adicionado botão `Salvar`, ainda desativado e identificado como `Em breve`, reservado para a futura integração com obras.

2. **Zoom e navegação no croqui**
   - Adicionados controles para aumentar e diminuir o zoom, informar a porcentagem, ajustar à tela e retornar à escala `1:1`.
   - A visualização abre por padrão em tamanho real, com zoom de `100%`.
   - É possível arrastar a imagem para navegar, usar as barras de rolagem ou alterar o zoom com `Ctrl` e a roda do mouse.
   - O zoom afeta somente a visualização, sem alterar a resolução do PNG baixado.

3. **Tamanho fixo para o PNG**
   - Adicionada escolha entre tamanho `Automático`, mantido como padrão, e `Tamanho fixo`.
   - No modo automático, as dimensões do PNG continuam acompanhando o tamanho do desenho.
   - O modo fixo começa em `640×480px` e permite editar largura e altura da imagem.
   - Desenhos menores ficam centralizados sem ampliação; desenhos maiores são reduzidos proporcionalmente para caber, incluindo suas cotas.
   - A área restante recebe fundo branco, sem deformar nem cortar o croqui.
   - Adicionada validação dos valores e bloqueio do download quando o tamanho informado é inválido.

4. **Contagem de componentes utilizados**
   - O resumo da visualização agora mostra as quantidades de `Maxim-ar`, `Veneziana`, `Porta de giro` e `ACM` presentes no desenho.
   - Somente componentes com quantidade maior que zero aparecem, e a seção fica oculta quando não há componentes.
   - Portas de dois módulos contam como uma única porta; aberturas à esquerda e à direita são agrupadas no mesmo total.
   - A contagem é atualizada ao gerar novamente o croqui após editar a fachada.

5. **Infinidade horizontal**
   - Adicionada escolha entre cortes `Vertical` e `Horizontal` no balão da Infinidade, com vertical selecionado por padrão.
   - O modo horizontal permite selecionar a primeira ou a última linha de quadros e aplicar o corte em toda a largura da fachada.
   - Somente os alvos da orientação escolhida ficam destacados em laranja, evitando sobreposição de opções.
   - O corte horizontal remove o trecho dos módulos e do contorno externo e interrompe a cota `H`, preservando a cota `L`.
   - É possível manter marcações nos dois sentidos; trocar a orientação não apaga os cortes já escolhidos.
   - Em fachadas com uma única linha ou coluna, as áreas de seleção são divididas para manter as duas extremidades acessíveis.

## Correções
1. **Troca de componente durante a configuração da porta**
   - Evitado que uma configuração cancelada da Porta de Giro limpe o modo de inserção de outro componente selecionado em seguida.

2. **Resultados atrasados na geração do PNG**
   - Fechar a visualização durante a geração descarta o resultado pendente, sem reabrir a tela depois de voltar ao editor.
   - Trocas rápidas nas opções de exportação mantêm o resultado da última seleção, evitando que uma imagem anterior substitua a configuração atual.

## Ajustes
1. **Edição de medidas em balão**
   - Os modais centrais de largura da coluna e altura da linha foram substituídos por balões no padrão das opções da Porta de Giro.
   - Mantidos o clique direto no rótulo e o botão de modificar, com confirmação verde e cancelamento vermelho.
   - A validação de `15` a `400cm` aparece no próprio balão, sem abrir outro modal central.

2. **Posição e ordem dos balões**
   - Os balões passaram do canto inferior esquerdo para o canto superior esquerdo da área do desenho.
   - Quando há mais de um, eles são organizados de cima para baixo: primeiro o aviso de inserção e depois as opções da Porta de Giro.
   - O cancelamento duplicado continua oculto no aviso de inserção enquanto a configuração da porta está aberta.

3. **Cancelamento e destaque da edição**
   - Removido o desfoque da interface; os alvos disponíveis continuam destacados em laranja.
   - Clicar fora dos balões e dos alvos válidos agora cancela como o X vermelho, sem inserir ou excluir componentes por acidente no grid.
   - O comportamento também vale para configurações de porta e medidas; Canto e Infinidade restauram as marcações anteriores à sessão ao cancelar.
   - Mantida a possibilidade de trocar diretamente para outro componente pela barra lateral.

4. **Escolha entre quadro único e linha inteira**
   - A escolha para `Maxim-ar`, `Veneziana` e `ACM` saiu dos menus flutuantes e passou para o balão de inserção.
   - Pela barra lateral, o modo começa em `Quadro único`, com opção de mudar para `Linha inteira`, sem confirmação adicional depois de clicar no alvo.
   - Pelo menu `+` da coluna A, o balão identifica o quadro selecionado e permite escolher a abrangência antes de confirmar a inserção.
   - Nas demais colunas, a inserção pelo `+` continua imediata e individual, sem balão de confirmação.
   - A inserção em linha inteira mantém os quadros já ocupados.

---

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
   - Também permite preencher uma linha inteira pela barra lateral ou pelo menu `+` da coluna A, mantendo os quadros já ocupados.
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
