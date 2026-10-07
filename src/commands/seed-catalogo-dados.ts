import type { CriarImovelDto } from '../imoveis/imoveis.dto';

/** Conteúdo ilustrativo persistente; fotos verificadas em docs/2026-10-03-fontes-catalogo.md. */
export interface ItemCatalogoCarga {
  chave: string;
  tipo_slug: string;
  finalidade_slug: string;
  dados: Omit<CriarImovelDto, 'tipo_id' | 'finalidade_id' | 'corretor_id' | 'caracteristicas' | 'observacoes_internas' | 'ativo'>;
  caracteristicas: readonly { nome: string; valor: string | null }[];
  fotos: readonly { url: string; pagina: string; autor: string }[];
}

export const caracteristicasCarga: readonly { nome: string; icone: string | null }[] = [
  {
    "nome": "Vagas de estacionamento",
    "icone": "Car"
  },
  {
    "nome": "Banheiros",
    "icone": "Bath"
  },
  {
    "nome": "Copa",
    "icone": "Coffee"
  },
  {
    "nome": "Acesso independente",
    "icone": "DoorOpen"
  },
  {
    "nome": "Iluminação natural",
    "icone": "Sun"
  },
  {
    "nome": "Vitrine",
    "icone": "Store"
  },
  {
    "nome": "Depósito",
    "icone": "Warehouse"
  },
  {
    "nome": "Pé-direito",
    "icone": "ArrowUpDown"
  },
  {
    "nome": "Área externa",
    "icone": "Trees"
  },
  {
    "nome": "Frente do terreno",
    "icone": "Ruler"
  }
];

/** Ordem das fotos: a primeira é a capa; o comando resolve somente cadastros ativos. */
export const catalogoCarga: readonly ItemCatalogoCarga[] = [
  {
    "chave": "01-sala-comercial",
    "tipo_slug": "sala-comercial",
    "finalidade_slug": "locacao",
    "dados": {
      "titulo": "Sala comercial com acesso independente no Centro",
      "valor_venda": null,
      "valor_locacao": "1350.00",
      "valor_condominio": "120.00",
      "valor_iptu": "48.00",
      "area_util": "48.00",
      "area_total": "56.00",
      "cep": null,
      "logradouro": "Rua de Referência A",
      "numero": "101",
      "complemento": "Sala 01",
      "bairro": "Centro",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Sala de 48 m² organizada para atendimento individual, pequenos escritórios ou serviços profissionais. O ambiente principal permite separar uma mesa de trabalho e uma área de espera, com entrada independente, banheiro e apoio de copa compartilhado.\n\nA proposta reúne uma metragem fácil de manter e boa entrada de luz para a rotina de trabalho. A ocupação deve considerar as adaptações necessárias à atividade; mobiliário e equipamentos mostrados nas referências visuais não integram a composição anunciada. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Banheiros",
        "valor": "1"
      },
      {
        "nome": "Copa",
        "valor": "Compartilhada"
      },
      {
        "nome": "Acesso independente",
        "valor": null
      },
      {
        "nome": "Iluminação natural",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1692133226337-55e513450a32?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/an-empty-room-with-a-desk-and-a-book-shelf-ohLMHYT25Y0",
        "autor": "Brian Wangenheim"
      },
      {
        "url": "https://images.unsplash.com/photo-1511362328651-90cc517fbe31?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/black-leather-rolling-armchair-near-white-wooden-desk-bXmfBgobSMI",
        "autor": "Unknown Wong"
      },
      {
        "url": "https://images.unsplash.com/photo-1697807665472-908cfe732b8e?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/a-room-with-a-desk-and-a-book-shelf-wDFwfdH6aEA",
        "autor": "Clay Banks"
      }
    ]
  },
  {
    "chave": "02-sala-comercial",
    "tipo_slug": "sala-comercial",
    "finalidade_slug": "locacao",
    "dados": {
      "titulo": "Sala ampla com copa e vagas para atendimento",
      "valor_venda": null,
      "valor_locacao": "2100.00",
      "valor_condominio": "230.00",
      "valor_iptu": "72.00",
      "area_util": "78.00",
      "area_total": "92.00",
      "cep": null,
      "logradouro": "Rua de Referência B",
      "numero": "138",
      "complemento": "Sala 02",
      "bairro": "Centro",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Conjunto comercial de 78 m² pensado para uma equipe pequena que precisa receber clientes com conforto. A área principal comporta estações de trabalho e espaço reservado para reuniões, acompanhados de copa privativa e dois banheiros.\n\nDuas vagas e a iluminação natural complementam uma distribuição que pode ser ajustada a escritórios de contabilidade, consultoria ou serviços administrativos. A configuração sugerida é uma referência de ocupação, sujeita à análise de acessibilidade e das exigências de cada atividade. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Banheiros",
        "valor": "2"
      },
      {
        "nome": "Copa",
        "valor": "Privativa"
      },
      {
        "nome": "Vagas de estacionamento",
        "valor": "2"
      },
      {
        "nome": "Iluminação natural",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1637665627832-dcd730049fbb?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/an-office-with-a-white-table-and-black-chairs-afFpd6TaLhU",
        "autor": "Craig Lovelidge"
      },
      {
        "url": "https://images.unsplash.com/photo-1579487785973-74d2ca7abdd5?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/black-and-brown-chairs-and-tables-DyFjxmHt3Es",
        "autor": "Jose Losada"
      },
      {
        "url": "https://images.unsplash.com/photo-1572521165329-b197f9ea3da6?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/chairs-beside-table-zCQsBI7ZltQ",
        "autor": "Raj Rana"
      }
    ]
  },
  {
    "chave": "03-sala-comercial",
    "tipo_slug": "sala-comercial",
    "finalidade_slug": "locacao",
    "dados": {
      "titulo": "Conjunto comercial iluminado para equipe e reuniões",
      "valor_venda": null,
      "valor_locacao": "3200.00",
      "valor_condominio": "380.00",
      "valor_iptu": "105.00",
      "area_util": "112.00",
      "area_total": "136.00",
      "cep": null,
      "logradouro": "Rua de Referência C",
      "numero": "175",
      "complemento": "Sala 03",
      "bairro": "Setor de Serviços",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Conjunto de 112 m² com espaço para recepção, trabalho em equipe e sala de reuniões. A proposta de distribuição privilegia circulação entre os ambientes, aproveitamento da iluminação natural e uma copa de apoio para a rotina do escritório.\n\nO acesso independente, os dois banheiros e as três vagas permitem planejar atendimento ao público sem concentrar toda a operação em uma única sala. Divisórias, mobiliário e infraestrutura específica devem ser definidos de acordo com o projeto da atividade. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": true
    },
    "caracteristicas": [
      {
        "nome": "Banheiros",
        "valor": "2"
      },
      {
        "nome": "Copa",
        "valor": "Privativa"
      },
      {
        "nome": "Acesso independente",
        "valor": null
      },
      {
        "nome": "Vagas de estacionamento",
        "valor": "3"
      },
      {
        "nome": "Iluminação natural",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1656646424651-95b048b70b1b?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/a-room-with-a-desk-and-chairs-jjAGReggTJ8",
        "autor": "Point3D Commercial Imaging Ltd."
      },
      {
        "url": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/hallway-between-glass-panel-doors-yWwob8kwOCk",
        "autor": "Nastuh Abootalebi"
      },
      {
        "url": "https://images.unsplash.com/photo-1503423571797-2d2bb372094a?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/long-table-with-eiffel-chair-inside-room-ULh0i2txBCY",
        "autor": "Pawel Chu"
      }
    ]
  },
  {
    "chave": "04-loja",
    "tipo_slug": "loja",
    "finalidade_slug": "locacao",
    "dados": {
      "titulo": "Loja térrea com salão aberto e depósito de apoio",
      "valor_venda": null,
      "valor_locacao": "2800.00",
      "valor_condominio": null,
      "valor_iptu": "86.00",
      "area_util": "110.00",
      "area_total": "135.00",
      "cep": null,
      "logradouro": "Rua de Referência D",
      "numero": "212",
      "complemento": null,
      "bairro": "Jardim Comércio",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Loja térrea de 110 m² com salão aberto para organizar exposição de produtos, atendimento e caixa. A vitrine de referência com quatro metros de frente favorece uma composição simples de fachada, enquanto o depósito de 12 m² ajuda a separar estoque e área de vendas.\n\nO banheiro, a copa de apoio e a entrada independente atendem a uma operação comercial compacta. O espaço pode receber diferentes soluções de layout, desde que respeitadas as condições de instalação, a acessibilidade e as licenças exigidas para o uso pretendido. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Vitrine",
        "valor": "4 m de frente"
      },
      {
        "nome": "Banheiros",
        "valor": "1"
      },
      {
        "nome": "Depósito",
        "valor": "12 m²"
      },
      {
        "nome": "Copa",
        "valor": "De apoio"
      },
      {
        "nome": "Acesso independente",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1641159930908-e9eb9ccdc002?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/an-empty-room-with-white-walls-and-a-black-door-q8fe785r5nU",
        "autor": "Andrea De Santis"
      },
      {
        "url": "https://images.unsplash.com/photo-1783987597078-84d5ac51d518?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/empty-modern-industrial-space-with-exposed-ceiling-and-textured-walls-aGgmKntVLJQ",
        "autor": "ULISES RAMIREZ"
      },
      {
        "url": "https://images.unsplash.com/photo-1783700085825-1df197a49f40?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/modern-empty-interior-with-wooden-furniture-and-concrete-walls-A1bMeaftZi4",
        "autor": "ULISES RAMIREZ"
      }
    ]
  },
  {
    "chave": "05-loja",
    "tipo_slug": "loja",
    "finalidade_slug": "locacao",
    "dados": {
      "titulo": "Loja espaçosa com vitrine e estacionamento frontal",
      "valor_venda": null,
      "valor_locacao": "4500.00",
      "valor_condominio": null,
      "valor_iptu": "145.00",
      "area_util": "185.00",
      "area_total": "240.00",
      "cep": null,
      "logradouro": "Rua de Referência E",
      "numero": "249",
      "complemento": null,
      "bairro": "Jardim Comércio",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Salão comercial de 185 m² para quem precisa de área de exposição e atendimento em um mesmo endereço. A frente de oito metros permite estudar uma vitrine contínua; o depósito de 28 m² oferece apoio para estoque, preparação de pedidos ou material de trabalho.\n\nQuatro vagas frontais e dois banheiros completam a proposta de ocupação. A distribuição aberta facilita o planejamento de uma loja de produtos, showroom ou serviços, com definição de instalações e comunicação visual conforme o projeto do negócio. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": true
    },
    "caracteristicas": [
      {
        "nome": "Vitrine",
        "valor": "8 m de frente"
      },
      {
        "nome": "Depósito",
        "valor": "28 m²"
      },
      {
        "nome": "Vagas de estacionamento",
        "valor": "4"
      },
      {
        "nome": "Banheiros",
        "valor": "2"
      },
      {
        "nome": "Acesso independente",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1591899916532-fc91c9d7fc01?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/white-concrete-building-with-white-walls-jaIx3CaUKHE",
        "autor": "Dimmis Vart"
      },
      {
        "url": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/clothes-store-interior-P3pI6xzovu0",
        "autor": "Clark Street Mercantile"
      },
      {
        "url": "https://images.unsplash.com/photo-1605217613423-0a61bd725c8a?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/white-wooden-cabinet-with-assorted-items-4oPEjtCv-gQ",
        "autor": "Anna Sullivan"
      }
    ]
  },
  {
    "chave": "06-loja",
    "tipo_slug": "loja",
    "finalidade_slug": "venda",
    "dados": {
      "titulo": "Ponto comercial com vitrine ampla e copa privativa",
      "valor_venda": "690000.00",
      "valor_locacao": null,
      "valor_condominio": null,
      "valor_iptu": "198.00",
      "area_util": "240.00",
      "area_total": "310.00",
      "cep": null,
      "logradouro": "Rua de Referência F",
      "numero": "286",
      "complemento": null,
      "bairro": "Setor de Serviços",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Ponto comercial de 240 m² com área principal voltada ao atendimento e espaço de apoio nos fundos. A vitrine de dez metros é uma referência para a composição da fachada, e o depósito de 35 m² permite manter materiais fora da circulação de clientes.\n\nA copa privativa e os dois banheiros favorecem uma rotina de equipe no local. A proposta pode atender comércio ou serviços, com estudo prévio da adequação das instalações e do layout; decoração, equipamentos e itens exibidos nas fotos não são bens incluídos na venda. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Vitrine",
        "valor": "10 m de frente"
      },
      {
        "nome": "Depósito",
        "valor": "35 m²"
      },
      {
        "nome": "Copa",
        "valor": "Privativa"
      },
      {
        "nome": "Banheiros",
        "valor": "2"
      },
      {
        "nome": "Iluminação natural",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1522126039546-182129aa0b93?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/empty-store-m5D5dHWHfSk",
        "autor": "Ian Valerio"
      },
      {
        "url": "https://images.unsplash.com/photo-1565878025290-41c0d172a619?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/blue-metal-chairs-beside-table-and-glass-window-C7APoWebVaU",
        "autor": "Tu Trinh"
      },
      {
        "url": "https://images.unsplash.com/photo-1782177387094-abe497c33c62?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/shop-interior-with-wooden-furniture-and-decorative-plants-7tc4dlLcXF0",
        "autor": "Declan Sun"
      }
    ]
  },
  {
    "chave": "07-galpao",
    "tipo_slug": "galpao",
    "finalidade_slug": "locacao",
    "dados": {
      "titulo": "Galpão com pátio e entrada independente",
      "valor_venda": null,
      "valor_locacao": "5800.00",
      "valor_condominio": null,
      "valor_iptu": "260.00",
      "area_util": "420.00",
      "area_total": "600.00",
      "cep": null,
      "logradouro": "Rua de Referência G",
      "numero": "323",
      "complemento": null,
      "bairro": "Distrito Empresarial",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Galpão de 420 m² de área útil, com salão de armazenagem e pátio externo de 180 m². O pé-direito de referência de seis metros permite planejar o aproveitamento vertical do espaço, conforme as cargas e os equipamentos que venham a ser utilizados.\n\nA entrada independente e os dois banheiros compõem uma base para estoque, distribuição local ou apoio de serviços. Fluxo de veículos, dimensionamento de estruturas e exigências de prevenção contra incêndio devem ser avaliados no projeto de ocupação. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Pé-direito",
        "valor": "6 m"
      },
      {
        "nome": "Área externa",
        "valor": "180 m²"
      },
      {
        "nome": "Banheiros",
        "valor": "2"
      },
      {
        "nome": "Depósito",
        "valor": "350 m² de armazenagem"
      },
      {
        "nome": "Acesso independente",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1694885169342-909981fb408a?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/a-large-empty-warehouse-with-no-people-in-it-D7A6CiIFVk8",
        "autor": "Brian Wangenheim"
      },
      {
        "url": "https://images.unsplash.com/photo-1694885171249-b17cbaf9beb5?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/an-empty-garage-with-no-one-in-it-RbVZJf-QVYg",
        "autor": "Brian Wangenheim"
      },
      {
        "url": "https://images.unsplash.com/photo-1790707844417-dcb466467516?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/storage-building-with-white-roll-up-doors-qxvQk2fp69U",
        "autor": "Adam Winger"
      }
    ]
  },
  {
    "chave": "08-galpao",
    "tipo_slug": "galpao",
    "finalidade_slug": "locacao",
    "dados": {
      "titulo": "Galpão amplo para armazenagem e distribuição",
      "valor_venda": null,
      "valor_locacao": "9500.00",
      "valor_condominio": "180.00",
      "valor_iptu": "420.00",
      "area_util": "860.00",
      "area_total": "1400.00",
      "cep": null,
      "logradouro": "Rua de Referência H",
      "numero": "360",
      "complemento": null,
      "bairro": "Distrito Empresarial",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Galpão de 860 m² com área de armazenagem de referência de 760 m² e setores de apoio para a operação. O salão amplo e o pé-direito de sete metros permitem estudar posições de estoque, circulação interna e áreas de separação de pedidos.\n\nO terreno de 1.400 m² reserva 540 m² externos, além de seis vagas e dois banheiros. A configuração foi pensada para distribuição e apoio comercial; capacidade do piso, manobra de veículos e instalações específicas exigem verificação técnica antes da ocupação. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": true
    },
    "caracteristicas": [
      {
        "nome": "Pé-direito",
        "valor": "7 m"
      },
      {
        "nome": "Área externa",
        "valor": "540 m²"
      },
      {
        "nome": "Vagas de estacionamento",
        "valor": "6"
      },
      {
        "nome": "Banheiros",
        "valor": "2"
      },
      {
        "nome": "Depósito",
        "valor": "760 m² de armazenagem"
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1771530789155-b1f03fbf82b5?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/empty-modern-warehouse-interior-with-polished-concrete-floor-3lkaszxWfGc",
        "autor": "Craftsman Concrete Floors"
      },
      {
        "url": "https://images.unsplash.com/photo-1772305336606-989a457ffbae?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/empty-industrial-warehouse-with-polished-concrete-floor-NADTQRbS0s4",
        "autor": "Craftsman Concrete Floors"
      },
      {
        "url": "https://images.unsplash.com/photo-1772300704502-410f0fbd43bb?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/spacious-empty-warehouse-interior-with-polished-concrete-floor-hnMqVv0EkRc",
        "autor": "Craftsman Concrete Floors"
      }
    ]
  },
  {
    "chave": "09-galpao",
    "tipo_slug": "galpao",
    "finalidade_slug": "venda",
    "dados": {
      "titulo": "Galpão comercial com pátio generoso e área de apoio",
      "valor_venda": "1650000.00",
      "valor_locacao": null,
      "valor_condominio": null,
      "valor_iptu": "680.00",
      "area_util": "1320.00",
      "area_total": "2400.00",
      "cep": null,
      "logradouro": "Rua de Referência I",
      "numero": "397",
      "complemento": null,
      "bairro": "Distrito Empresarial",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Imóvel comercial com 1.320 m² de área útil em terreno de 2.400 m². A proposta reúne salão de armazenagem, área de apoio e pé-direito de referência de oito metros, com espaço externo para organizar circulação e atendimento de fornecedores.\n\nO pátio de 1.080 m² e as oito vagas oferecem margem para planejar a operação conforme a atividade. A aquisição pressupõe análise técnica do uso, da documentação e das instalações; as fotos representam possibilidades de ambientes industriais e não comprovação de uma estrutura específica. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Pé-direito",
        "valor": "8 m"
      },
      {
        "nome": "Área externa",
        "valor": "1080 m²"
      },
      {
        "nome": "Vagas de estacionamento",
        "valor": "8"
      },
      {
        "nome": "Banheiros",
        "valor": "3"
      },
      {
        "nome": "Acesso independente",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1780367261654-45395777b560?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/a-row-of-loading-docks-on-a-commercial-building-SJGC3NNOqU4",
        "autor": "Matthew Jackson"
      },
      {
        "url": "https://images.unsplash.com/photo-1726776230760-ae81dc9d4e55?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/an-aerial-view-of-a-building-with-a-lot-of-solar-panels-iDSXatl7yNo",
        "autor": "Bernd 📷 Dittrich"
      },
      {
        "url": "https://images.unsplash.com/photo-1565610222536-ef125c59da2e?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/gray-concrete-flooring-_rD1pJwWpbU",
        "autor": "Wilhelm Gunkel"
      }
    ]
  },
  {
    "chave": "10-terreno",
    "tipo_slug": "terreno",
    "finalidade_slug": "venda",
    "dados": {
      "titulo": "Terreno de 600 m² para projeto comercial",
      "valor_venda": "285000.00",
      "valor_locacao": null,
      "valor_condominio": null,
      "valor_iptu": "95.00",
      "area_util": "600.00",
      "area_total": "600.00",
      "cep": null,
      "logradouro": "Rua de Referência J",
      "numero": "434",
      "complemento": null,
      "bairro": "Expansão Norte",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Terreno de referência de 600 m², com frente de vinte metros, para estudar uma construção voltada a comércio ou serviços. A área aberta permite organizar acesso, implantação da edificação e espaços de apoio conforme o porte do projeto.\n\nUma opção de composição do catálogo para quem busca planejar o imóvel desde a implantação. Potencial construtivo, zoneamento, acesso às redes, condições do solo e aprovação de projeto precisam ser consultados; não se presume infraestrutura ou autorização urbanística a partir das imagens. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Frente do terreno",
        "valor": "20 m"
      },
      {
        "nome": "Área externa",
        "valor": "600 m²"
      },
      {
        "nome": "Acesso independente",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1668302656385-4ed3806ae41b?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/a-field-with-a-fence-and-trees-TuvBQ47exp0",
        "autor": "Guilherme von Natur"
      },
      {
        "url": "https://images.unsplash.com/photo-1690989751090-e29411e007b2?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/the-sun-is-setting-over-a-field-of-grass-6ZjMqWkQKhc",
        "autor": "Agnieszka Stankiewicz"
      },
      {
        "url": "https://images.unsplash.com/photo-1687398013284-5c7681e5d524?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/a-grassy-area-with-a-lot-of-trees-and-grass-btuzsFV2XL8",
        "autor": "MChe Lee"
      }
    ]
  },
  {
    "chave": "11-terreno",
    "tipo_slug": "terreno",
    "finalidade_slug": "locacao-e-venda",
    "dados": {
      "titulo": "Área comercial de 2.400 m² com condições sob consulta",
      "valor_venda": null,
      "valor_locacao": null,
      "valor_condominio": null,
      "valor_iptu": null,
      "area_util": "2400.00",
      "area_total": "2400.00",
      "cep": null,
      "logradouro": "Rua de Referência K",
      "numero": "471",
      "complemento": null,
      "bairro": "Expansão Norte",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Área de referência de 2.400 m² para estudar implantação comercial, apoio operacional ou uso compatível com um projeto próprio. A frente de quarenta metros serve como base de composição para organizar acesso e distribuição das atividades no terreno.\n\nAs modalidades de locação e venda estão previstas, com valores e encargos sob consulta. Qualquer proposta depende da definição de uso, prazo e condições da negociação, além da análise de zoneamento, infraestrutura, solo e autorizações necessárias à ocupação. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Frente do terreno",
        "valor": "40 m"
      },
      {
        "nome": "Área externa",
        "valor": "2400 m²"
      },
      {
        "nome": "Acesso independente",
        "valor": null
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1657100414642-492e108d91d7?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/a-close-up-of-a-green-field-OTovFM3hn3s",
        "autor": "Matheus Frade"
      },
      {
        "url": "https://images.unsplash.com/photo-1787773894172-50005b81be16?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/lone-tree-on-plowed-brown-field-vqNYntkDMCw",
        "autor": "Bernd 📷 Dittrich"
      },
      {
        "url": "https://images.unsplash.com/photo-1624856472328-bfcf71c34741?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/brown-grass-field-under-gray-clouds-z9WEWdRywrU",
        "autor": "Matt Palmer"
      }
    ]
  },
  {
    "chave": "12-predio",
    "tipo_slug": "predio",
    "finalidade_slug": "venda",
    "dados": {
      "titulo": "Prédio comercial para organizar atendimento e escritórios",
      "valor_venda": "2850000.00",
      "valor_locacao": null,
      "valor_condominio": "850.00",
      "valor_iptu": "920.00",
      "area_util": "980.00",
      "area_total": "1250.00",
      "cep": null,
      "logradouro": "Rua de Referência L",
      "numero": "508",
      "complemento": null,
      "bairro": "Setor de Serviços",
      "cidade": "Juara",
      "estado": "MT",
      "descricao": "Prédio comercial de referência com 980 m² de área útil para distribuir recepção, atendimento e escritórios em pavimentos. A proposta contempla circulação entre setores, ambientes de reunião e áreas de apoio que podem ser ajustadas ao tamanho da equipe.\n\nOito vagas, seis banheiros e copa de apoio completam a composição para uma sede de serviços ou ocupação por diferentes equipes. A divisão interna, acessibilidade e sistemas prediais precisam ser avaliados de acordo com o projeto; não se presume elevador, equipamento ou certificação pelas fotografias. Imagens ilustrativas; endereço de referência para composição do catálogo.",
      "destaque": false
    },
    "caracteristicas": [
      {
        "nome": "Vagas de estacionamento",
        "valor": "8"
      },
      {
        "nome": "Banheiros",
        "valor": "6"
      },
      {
        "nome": "Copa",
        "valor": "De apoio"
      },
      {
        "nome": "Iluminação natural",
        "valor": null
      },
      {
        "nome": "Área externa",
        "valor": "270 m²"
      }
    ],
    "fotos": [
      {
        "url": "https://images.unsplash.com/photo-1599580546666-c26f15e00933?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/white-and-blue-building-under-cloudy-sky-during-daytime-4nMj4N6rK4M",
        "autor": "Elifin Realty"
      },
      {
        "url": "https://images.unsplash.com/photo-1632398793634-e3cd63fc9e84?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/a-long-hallway-with-a-plant-growing-on-the-wall-Fw8r2JGvJ7U",
        "autor": "Parth Savani"
      },
      {
        "url": "https://images.unsplash.com/photo-1594233666755-d1cb282abd25?w=1400&q=80&fit=crop&fm=jpg",
        "pagina": "https://unsplash.com/photos/white-and-black-concrete-building-under-blue-sky-during-daytime-WaAa14Wvpgg",
        "autor": "Swapnil Potdar"
      }
    ]
  }
];
