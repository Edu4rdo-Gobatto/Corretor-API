# Fontes do catálogo ilustrativo — 03/10/2026

Manifesto: `src/commands/seed-catalogo-dados.ts`. São 12 anúncios de conteúdo original para Juara/MT, com três fotos por anúncio e 12 capas distintas. As 36 imagens são distintas; não foi necessário reutilizar foto auxiliar. A primeira foto de cada item é sua capa.

Os títulos e as descrições foram escritos para esta carga, sem copiar anúncios reais. Preços, áreas, características e encargos são ilustrativos; não constituem avaliação de mercado ou disponibilidade comercial confirmada. Os logradouros Rua de Referência A a L e seus números são sintéticos, assim como a composição dos endereços. As fotografias podem retratar lugares de outros países e não identificam um imóvel existente em Juara. Mobiliário, instalações e cenário das referências visuais não comprovam itens incluídos na negociação.

Cada descrição tem dois parágrafos e termina com a nota pública discreta: “Imagens ilustrativas; endereço de referência para composição do catálogo.” O frontend continua usando a API e o banco existentes; o manifesto não cria modo demo ou catálogo alternativo. Os preços, áreas e características também são conteúdo sintético de referência, não uma oferta confirmada.

## Licença e seleção

Fonte primária consultada em 03/10/2026: [Unsplash License](https://unsplash.com/license). A licença permite baixar e usar gratuitamente imagens em finalidade comercial e não comercial. As restrições incluem revender imagens sem alteração significativa ou formar um serviço concorrente de imagens. A autoria foi preservada neste documento e no manifesto.

Para cada foto, foi conferido o `ImageObject` público da página: `isAccessibleForFree: true`, licença `https://unsplash.com/license`, autor e URL original do domínio `images.unsplash.com`. Nenhuma foto selecionada usa Unsplash+ ou domínio `plus.unsplash.com`. A revisão visual priorizou salas, espaços de loja, galpões, terrenos e edifícios; retirou referências com pessoas em destaque, logomarcas reconhecíveis e cenários inadequados ao tipo. Galerias são referências de ambientes, sem alegar que todas as fotos de um anúncio foram feitas no mesmo local.

## Verificação HTTP

Em 03/10/2026, as 36 URLs fixas do manifesto foram acessadas por GET completo somente para leitura em memória: todas retornaram HTTP 200, MIME `image/jpeg`, assinatura JPEG `FF D8 FF` e tamanho inferior a 10 MiB. Tamanhos: mínimo 96.566 bytes; máximo 1.506.525 bytes. URLs usam `w=1400&q=80&fit=crop&fm=jpg`; não há endpoint aleatório. Foram inspecionadas miniaturas em folhas de contato.

Esta verificação comprova disponibilidade e formato nessa data, não estabilidade futura do serviço. Em 03/10/2026 as mesmas 36 URLs foram verificadas novamente por HEAD, todas com HTTP 200. Se uma foto ficar indisponível, o comando deve interromper a conclusão da galeria e conservar o anúncio inativo para retomada. Não selecionar imagem aleatória, não publicar galeria incompleta e não inventar autor ou licença. Uma substituição exige foto gratuita confirmada, nova URL fixa e atualização do manifesto e deste registro antes da retomada.

## Composição dos anúncios

| Item/chave | Título | Tipo | Finalidade | Destaque |
|---|---|---|---|---|
| 1 / `01-sala-comercial` | Sala comercial com acesso independente no Centro | sala-comercial | locacao | Não |
| 2 / `02-sala-comercial` | Sala ampla com copa e vagas para atendimento | sala-comercial | locacao | Não |
| 3 / `03-sala-comercial` | Conjunto comercial iluminado para equipe e reuniões | sala-comercial | locacao | Sim |
| 4 / `04-loja` | Loja térrea com salão aberto e depósito de apoio | loja | locacao | Não |
| 5 / `05-loja` | Loja espaçosa com vitrine e estacionamento frontal | loja | locacao | Sim |
| 6 / `06-loja` | Ponto comercial com vitrine ampla e copa privativa | loja | venda | Não |
| 7 / `07-galpao` | Galpão com pátio e entrada independente | galpao | locacao | Não |
| 8 / `08-galpao` | Galpão amplo para armazenagem e distribuição | galpao | locacao | Sim |
| 9 / `09-galpao` | Galpão comercial com pátio generoso e área de apoio | galpao | venda | Não |
| 10 / `10-terreno` | Terreno de 600 m² para projeto comercial | terreno | venda | Não |
| 11 / `11-terreno` | Área comercial de 2.400 m² com condições sob consulta | terreno | locacao-e-venda | Não |
| 12 / `12-predio` | Prédio comercial para organizar atendimento e escritórios | predio | venda | Não |

Distribuição: 3 salas, 3 lojas, 3 galpões, 2 terrenos e 1 prédio; 7 locações, 4 vendas e 1 locação/venda. O item 11, terreno com ambas as finalidades, mantém `valor_venda` e `valor_locacao` nulos e informa condições sob consulta. Áreas e preços informados são strings decimais positivas; todas as áreas totais são maiores ou iguais às úteis. Há de 3 a 5 características por anúncio, escolhidas entre 10 nomes funcionais. Classificações e características são resolvidas pelo comando apenas quando o cadastro vigente estiver ativo.

## Proveniência por item e posição

Cada registro abaixo corresponde exatamente à posição da foto em `catalogoCarga`; posição 1 = capa. O link da página confirma descrição, autor e licença. O link JPEG é a URL fixa usada no download.

| Item | Foto | Autor | Página de origem | JPEG do manifesto | Bytes / HTTP / MIME |
|---|---|---|---|---|---|
| 1 | 1 (capa) | Brian Wangenheim | [Foto no Unsplash](https://unsplash.com/photos/an-empty-room-with-a-desk-and-a-book-shelf-ohLMHYT25Y0) | [JPEG](https://images.unsplash.com/photo-1692133226337-55e513450a32?w=1400&q=80&fit=crop&fm=jpg) | 160684 / 200 / image/jpeg |
| 1 | 2 | Unknown Wong | [Foto no Unsplash](https://unsplash.com/photos/black-leather-rolling-armchair-near-white-wooden-desk-bXmfBgobSMI) | [JPEG](https://images.unsplash.com/photo-1511362328651-90cc517fbe31?w=1400&q=80&fit=crop&fm=jpg) | 158435 / 200 / image/jpeg |
| 1 | 3 | Clay Banks | [Foto no Unsplash](https://unsplash.com/photos/a-room-with-a-desk-and-a-book-shelf-wDFwfdH6aEA) | [JPEG](https://images.unsplash.com/photo-1697807665472-908cfe732b8e?w=1400&q=80&fit=crop&fm=jpg) | 228822 / 200 / image/jpeg |
| 2 | 1 (capa) | Craig Lovelidge | [Foto no Unsplash](https://unsplash.com/photos/an-office-with-a-white-table-and-black-chairs-afFpd6TaLhU) | [JPEG](https://images.unsplash.com/photo-1637665627832-dcd730049fbb?w=1400&q=80&fit=crop&fm=jpg) | 177217 / 200 / image/jpeg |
| 2 | 2 | Jose Losada | [Foto no Unsplash](https://unsplash.com/photos/black-and-brown-chairs-and-tables-DyFjxmHt3Es) | [JPEG](https://images.unsplash.com/photo-1579487785973-74d2ca7abdd5?w=1400&q=80&fit=crop&fm=jpg) | 419571 / 200 / image/jpeg |
| 2 | 3 | Raj Rana | [Foto no Unsplash](https://unsplash.com/photos/chairs-beside-table-zCQsBI7ZltQ) | [JPEG](https://images.unsplash.com/photo-1572521165329-b197f9ea3da6?w=1400&q=80&fit=crop&fm=jpg) | 215362 / 200 / image/jpeg |
| 3 | 1 (capa) | Point3D Commercial Imaging Ltd. | [Foto no Unsplash](https://unsplash.com/photos/a-room-with-a-desk-and-chairs-jjAGReggTJ8) | [JPEG](https://images.unsplash.com/photo-1656646424651-95b048b70b1b?w=1400&q=80&fit=crop&fm=jpg) | 283582 / 200 / image/jpeg |
| 3 | 2 | Nastuh Abootalebi | [Foto no Unsplash](https://unsplash.com/photos/hallway-between-glass-panel-doors-yWwob8kwOCk) | [JPEG](https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1400&q=80&fit=crop&fm=jpg) | 188983 / 200 / image/jpeg |
| 3 | 3 | Pawel Chu | [Foto no Unsplash](https://unsplash.com/photos/long-table-with-eiffel-chair-inside-room-ULh0i2txBCY) | [JPEG](https://images.unsplash.com/photo-1503423571797-2d2bb372094a?w=1400&q=80&fit=crop&fm=jpg) | 148937 / 200 / image/jpeg |
| 4 | 1 (capa) | Andrea De Santis | [Foto no Unsplash](https://unsplash.com/photos/an-empty-room-with-white-walls-and-a-black-door-q8fe785r5nU) | [JPEG](https://images.unsplash.com/photo-1641159930908-e9eb9ccdc002?w=1400&q=80&fit=crop&fm=jpg) | 109919 / 200 / image/jpeg |
| 4 | 2 | ULISES RAMIREZ | [Foto no Unsplash](https://unsplash.com/photos/empty-modern-industrial-space-with-exposed-ceiling-and-textured-walls-aGgmKntVLJQ) | [JPEG](https://images.unsplash.com/photo-1783987597078-84d5ac51d518?w=1400&q=80&fit=crop&fm=jpg) | 193455 / 200 / image/jpeg |
| 4 | 3 | ULISES RAMIREZ | [Foto no Unsplash](https://unsplash.com/photos/modern-empty-interior-with-wooden-furniture-and-concrete-walls-A1bMeaftZi4) | [JPEG](https://images.unsplash.com/photo-1783700085825-1df197a49f40?w=1400&q=80&fit=crop&fm=jpg) | 157139 / 200 / image/jpeg |
| 5 | 1 (capa) | Dimmis Vart | [Foto no Unsplash](https://unsplash.com/photos/white-concrete-building-with-white-walls-jaIx3CaUKHE) | [JPEG](https://images.unsplash.com/photo-1591899916532-fc91c9d7fc01?w=1400&q=80&fit=crop&fm=jpg) | 96566 / 200 / image/jpeg |
| 5 | 2 | Clark Street Mercantile | [Foto no Unsplash](https://unsplash.com/photos/clothes-store-interior-P3pI6xzovu0) | [JPEG](https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=80&fit=crop&fm=jpg) | 244412 / 200 / image/jpeg |
| 5 | 3 | Anna Sullivan | [Foto no Unsplash](https://unsplash.com/photos/white-wooden-cabinet-with-assorted-items-4oPEjtCv-gQ) | [JPEG](https://images.unsplash.com/photo-1605217613423-0a61bd725c8a?w=1400&q=80&fit=crop&fm=jpg) | 424157 / 200 / image/jpeg |
| 6 | 1 (capa) | Ian Valerio | [Foto no Unsplash](https://unsplash.com/photos/empty-store-m5D5dHWHfSk) | [JPEG](https://images.unsplash.com/photo-1522126039546-182129aa0b93?w=1400&q=80&fit=crop&fm=jpg) | 304528 / 200 / image/jpeg |
| 6 | 2 | Tu Trinh | [Foto no Unsplash](https://unsplash.com/photos/blue-metal-chairs-beside-table-and-glass-window-C7APoWebVaU) | [JPEG](https://images.unsplash.com/photo-1565878025290-41c0d172a619?w=1400&q=80&fit=crop&fm=jpg) | 252396 / 200 / image/jpeg |
| 6 | 3 | Declan Sun | [Foto no Unsplash](https://unsplash.com/photos/shop-interior-with-wooden-furniture-and-decorative-plants-7tc4dlLcXF0) | [JPEG](https://images.unsplash.com/photo-1782177387094-abe497c33c62?w=1400&q=80&fit=crop&fm=jpg) | 419466 / 200 / image/jpeg |
| 7 | 1 (capa) | Brian Wangenheim | [Foto no Unsplash](https://unsplash.com/photos/a-large-empty-warehouse-with-no-people-in-it-D7A6CiIFVk8) | [JPEG](https://images.unsplash.com/photo-1694885169342-909981fb408a?w=1400&q=80&fit=crop&fm=jpg) | 209884 / 200 / image/jpeg |
| 7 | 2 | Brian Wangenheim | [Foto no Unsplash](https://unsplash.com/photos/an-empty-garage-with-no-one-in-it-RbVZJf-QVYg) | [JPEG](https://images.unsplash.com/photo-1694885171249-b17cbaf9beb5?w=1400&q=80&fit=crop&fm=jpg) | 220924 / 200 / image/jpeg |
| 7 | 3 | Adam Winger | [Foto no Unsplash](https://unsplash.com/photos/storage-building-with-white-roll-up-doors-qxvQk2fp69U) | [JPEG](https://images.unsplash.com/photo-1790707844417-dcb466467516?w=1400&q=80&fit=crop&fm=jpg) | 433616 / 200 / image/jpeg |
| 8 | 1 (capa) | Craftsman Concrete Floors | [Foto no Unsplash](https://unsplash.com/photos/empty-modern-warehouse-interior-with-polished-concrete-floor-3lkaszxWfGc) | [JPEG](https://images.unsplash.com/photo-1771530789155-b1f03fbf82b5?w=1400&q=80&fit=crop&fm=jpg) | 366474 / 200 / image/jpeg |
| 8 | 2 | Craftsman Concrete Floors | [Foto no Unsplash](https://unsplash.com/photos/empty-industrial-warehouse-with-polished-concrete-floor-NADTQRbS0s4) | [JPEG](https://images.unsplash.com/photo-1772305336606-989a457ffbae?w=1400&q=80&fit=crop&fm=jpg) | 256785 / 200 / image/jpeg |
| 8 | 3 | Craftsman Concrete Floors | [Foto no Unsplash](https://unsplash.com/photos/spacious-empty-warehouse-interior-with-polished-concrete-floor-hnMqVv0EkRc) | [JPEG](https://images.unsplash.com/photo-1772300704502-410f0fbd43bb?w=1400&q=80&fit=crop&fm=jpg) | 279595 / 200 / image/jpeg |
| 9 | 1 (capa) | Matthew Jackson | [Foto no Unsplash](https://unsplash.com/photos/a-row-of-loading-docks-on-a-commercial-building-SJGC3NNOqU4) | [JPEG](https://images.unsplash.com/photo-1780367261654-45395777b560?w=1400&q=80&fit=crop&fm=jpg) | 158759 / 200 / image/jpeg |
| 9 | 2 | Bernd 📷 Dittrich | [Foto no Unsplash](https://unsplash.com/photos/an-aerial-view-of-a-building-with-a-lot-of-solar-panels-iDSXatl7yNo) | [JPEG](https://images.unsplash.com/photo-1726776230760-ae81dc9d4e55?w=1400&q=80&fit=crop&fm=jpg) | 878637 / 200 / image/jpeg |
| 9 | 3 | Wilhelm Gunkel | [Foto no Unsplash](https://unsplash.com/photos/gray-concrete-flooring-_rD1pJwWpbU) | [JPEG](https://images.unsplash.com/photo-1565610222536-ef125c59da2e?w=1400&q=80&fit=crop&fm=jpg) | 345212 / 200 / image/jpeg |
| 10 | 1 (capa) | Guilherme von Natur | [Foto no Unsplash](https://unsplash.com/photos/a-field-with-a-fence-and-trees-TuvBQ47exp0) | [JPEG](https://images.unsplash.com/photo-1668302656385-4ed3806ae41b?w=1400&q=80&fit=crop&fm=jpg) | 345865 / 200 / image/jpeg |
| 10 | 2 | Agnieszka Stankiewicz | [Foto no Unsplash](https://unsplash.com/photos/the-sun-is-setting-over-a-field-of-grass-6ZjMqWkQKhc) | [JPEG](https://images.unsplash.com/photo-1690989751090-e29411e007b2?w=1400&q=80&fit=crop&fm=jpg) | 200045 / 200 / image/jpeg |
| 10 | 3 | MChe Lee | [Foto no Unsplash](https://unsplash.com/photos/a-grassy-area-with-a-lot-of-trees-and-grass-btuzsFV2XL8) | [JPEG](https://images.unsplash.com/photo-1687398013284-5c7681e5d524?w=1400&q=80&fit=crop&fm=jpg) | 418695 / 200 / image/jpeg |
| 11 | 1 (capa) | Matheus Frade | [Foto no Unsplash](https://unsplash.com/photos/a-close-up-of-a-green-field-OTovFM3hn3s) | [JPEG](https://images.unsplash.com/photo-1657100414642-492e108d91d7?w=1400&q=80&fit=crop&fm=jpg) | 1506525 / 200 / image/jpeg |
| 11 | 2 | Bernd 📷 Dittrich | [Foto no Unsplash](https://unsplash.com/photos/lone-tree-on-plowed-brown-field-vqNYntkDMCw) | [JPEG](https://images.unsplash.com/photo-1787773894172-50005b81be16?w=1400&q=80&fit=crop&fm=jpg) | 712948 / 200 / image/jpeg |
| 11 | 3 | Matt Palmer | [Foto no Unsplash](https://unsplash.com/photos/brown-grass-field-under-gray-clouds-z9WEWdRywrU) | [JPEG](https://images.unsplash.com/photo-1624856472328-bfcf71c34741?w=1400&q=80&fit=crop&fm=jpg) | 213397 / 200 / image/jpeg |
| 12 | 1 (capa) | Elifin Realty | [Foto no Unsplash](https://unsplash.com/photos/white-and-blue-building-under-cloudy-sky-during-daytime-4nMj4N6rK4M) | [JPEG](https://images.unsplash.com/photo-1599580546666-c26f15e00933?w=1400&q=80&fit=crop&fm=jpg) | 215063 / 200 / image/jpeg |
| 12 | 2 | Parth Savani | [Foto no Unsplash](https://unsplash.com/photos/a-long-hallway-with-a-plant-growing-on-the-wall-Fw8r2JGvJ7U) | [JPEG](https://images.unsplash.com/photo-1632398793634-e3cd63fc9e84?w=1400&q=80&fit=crop&fm=jpg) | 221024 / 200 / image/jpeg |
| 12 | 3 | Swapnil Potdar | [Foto no Unsplash](https://unsplash.com/photos/white-and-black-concrete-building-under-blue-sky-during-daytime-WaAa14Wvpgg) | [JPEG](https://images.unsplash.com/photo-1594233666755-d1cb282abd25?w=1400&q=80&fit=crop&fm=jpg) | 218763 / 200 / image/jpeg |

## Execução persistente — 03/10/2026

Foram inseridos 12 imóveis, 9 características, 1 corretor ADMIN e 36 mídias. Todos os imóveis foram publicados com as três imagens verificadas; o comando repetido os ignorou sem duplicar dados. Codice é o corretor responsável, e o ADMIN ativo id 1 ficou como autor técnico da auditoria. Nenhuma pessoa, contrato, comissão, contato ou migration foi criado.

Todos os 36 objetos foram enviados e seus bytes conferidos no bucket `corretor-midia`. Porém a URL pública configurada (`r2.dev`) retornou HTTP 401 nas três primeiras mídias verificadas. A política do bucket não foi alterada; `imoveis_midias.url` usa a URL original licenciada `images.unsplash.com`, enquanto o R2 conserva cópias dos arquivos. A galeria SSR abriu no browser e carregou a capa em 1400×933; as 36 URLs responderam HTTP 200 no teste final. A capa será servida pela Unsplash, cuja disponibilidade pode mudar; configure uma URL pública própria do R2 para deixar de depender da CDN externa.

Backup completo criado antes de qualquer escrita em diretório ACL-restrito fora do repositório, validado para o banco de destino e conferido de novo ao final: 39 tabelas, 114 linhas iniciais; todas as linhas preexistentes preservadas. O diff permitido contém 1 corretor, 9 características, 12 imóveis, 54 vínculos de características e 36 mídias. Sem migration, commit, push ou deploy.

Validação final da API: `npm run typecheck`, `npm run lint` e `npm run build` aprovados após as alterações finais. `npm test` terminou exit 1 porque não há suítes fonte, removidas a pedido do dono; isso não foi contado como aprovação. Não foram recriadas suítes.
