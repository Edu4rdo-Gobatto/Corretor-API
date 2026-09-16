import { Corretor } from '../corretores/corretor.entity';
import { SessaoLogin } from '../autenticacao/sessao-login.entity';
import { TipoImovel, FinalidadeImovel, Caracteristica, ImovelCaracteristica } from '../cadastros/cadastros.entity';
import { Imovel } from '../imoveis/imovel.entity';
import { ImovelMidia } from '../midias/imovel-midia.entity';
import { Pessoa } from '../pessoas/pessoa.entity';
import { Contrato } from '../locacoes/contrato.entity';
import { Comissao } from '../comissoes/comissao.entity';
import { ParcelaComissao } from '../comissoes/parcela-comissao.entity';
import { RegistroPastaDrive } from '../drive/registro-pasta-drive.entity';
import { CreateAgents1789084800000 } from './migrations/1789084800000-create-agents';
import { CreateProperties1789084801000 } from './migrations/1789084801000-create-properties';
import { CreatePropertyMedia1789084802000 } from './migrations/1789084802000-create-property-media';
import { CreateLeads1789084803000 } from './migrations/1789084803000-create-leads';
import { CreateRefreshSessions1789084804000 } from './migrations/1789084804000-create-refresh-sessions';
import { CreateRentalAdministration1789257600000 } from './migrations/1789257600000-create-rental-administration';
import { CreateAcquisitionCommissions1789344000000 } from './migrations/1789344000000-create-acquisition-commissions';
import { CreateRentPayments1789430400000 } from './migrations/1789430400000-create-rent-payments';
import { ModeloPortugues1789516800000 } from './migrations/1789516800000-modelo-portugues';
import { IdsInteirosPessoas1789603200000 } from './migrations/1789603200000-ids-inteiros-pessoas';

export const entidades = [Corretor, SessaoLogin, TipoImovel, FinalidadeImovel, Caracteristica, ImovelCaracteristica, Imovel, ImovelMidia, Pessoa, Contrato, Comissao, ParcelaComissao, RegistroPastaDrive];
// O histórico aplicado permanece imutável. Hardening nunca esteve registrado no CLI deste checkout.
export const migracoesLegadas = [CreateAgents1789084800000, CreateProperties1789084801000, CreatePropertyMedia1789084802000, CreateLeads1789084803000, CreateRefreshSessions1789084804000, CreateRentalAdministration1789257600000, CreateAcquisitionCommissions1789344000000, CreateRentPayments1789430400000];
export const migracoes = [...migracoesLegadas, ModeloPortugues1789516800000, IdsInteirosPessoas1789603200000];
