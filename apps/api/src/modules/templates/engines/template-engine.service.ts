import { Injectable, Logger } from '@nestjs/common';
import * as Docxtemplater from 'docxtemplater';
import * as PizZip from 'pizzip';
import * as Handlebars from 'handlebars';
import { addDays, differenceInDays, differenceInYears, format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface VariableInfo {
  name: string;
  path: string;
  isValid: boolean;
  description?: string;
}

export interface RenderResult {
  buffer: Buffer;
  variables: string[];
  usedVariables: string[];
}

// Registry of all known static variables
export const KNOWN_VARIABLES: Record<string, string> = {
  // Funcionário - Pessoal
  'funcionario.nome': 'Nome completo do funcionário',
  'funcionario.nome_social': 'Nome social do funcionário',
  'funcionario.cpf': 'CPF do funcionário',
  'funcionario.rg': 'RG do funcionário',
  'funcionario.email': 'Email do funcionário',
  'funcionario.telefone': 'Telefone fixo',
  'funcionario.celular': 'Celular',
  'funcionario.data_nascimento': 'Data de nascimento',
  'funcionario.genero': 'Gênero',
  'funcionario.estado_civil': 'Estado civil',
  'funcionario.nacionalidade': 'Nacionalidade',
  // Funcionário - Profissional
  'funcionario.matricula': 'Matrícula',
  'funcionario.cargo': 'Cargo',
  'funcionario.setor': 'Setor/Departamento',
  'funcionario.data_admissao': 'Data de admissão',
  'funcionario.data_demissao': 'Data de demissão',
  // Funcionário - Calculados
  'funcionario.fim_experiencia': 'Fim do período de experiência (admissão + 90 dias)',
  'funcionario.fim_experiencia_prorrogada': 'Fim da prorrogação (admissão + 180 dias)',
  'funcionario.anos_empresa': 'Anos de empresa',
  'funcionario.tempo_empresa': 'Tempo de empresa por extenso',
  'funcionario.idade': 'Idade atual',
  // Funcionário - Endereço
  'funcionario.endereco': 'Endereço completo',
  'funcionario.cep': 'CEP',
  'funcionario.rua': 'Rua',
  'funcionario.numero': 'Número',
  'funcionario.complemento': 'Complemento',
  'funcionario.bairro': 'Bairro',
  'funcionario.cidade': 'Cidade',
  'funcionario.estado': 'Estado (UF)',
  // Funcionário - Bancário
  'funcionario.banco': 'Nome do banco',
  'funcionario.agencia': 'Agência bancária',
  'funcionario.conta': 'Conta bancária',
  'funcionario.pix': 'Chave PIX',
  'funcionario.pis': 'PIS/PASEP',
  'funcionario.ctps': 'CTPS',
  'funcionario.ctps_serie': 'Série da CTPS',
  'funcionario.ctps_estado': 'Estado da CTPS',
  // Empresa
  'empresa.nome': 'Nome da empresa',
  'empresa.nome_fantasia': 'Nome fantasia da empresa',
  'empresa.cnpj': 'CNPJ da empresa',
  'empresa.endereco': 'Endereço da empresa',
  'empresa.cidade': 'Cidade da empresa',
  'empresa.estado': 'Estado da empresa',
  'empresa.cep': 'CEP da empresa',
  'empresa.telefone': 'Telefone da empresa',
  'empresa.email': 'Email da empresa',
  // Data/Hora
  'data.hoje': 'Data atual (DD/MM/YYYY)',
  'data.hoje_extenso': 'Data atual por extenso',
  'data.ano': 'Ano atual',
  'data.mes': 'Mês atual',
  'data.dia': 'Dia atual',
};

@Injectable()
export class TemplateEngineService {
  private readonly logger = new Logger(TemplateEngineService.name);

  /**
   * Extract all {{variable}} placeholders from DOCX buffer
   */
  async extractVariablesFromDocx(buffer: Buffer): Promise<VariableInfo[]> {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
    });

    const tags = doc.getFullText()
      .match(/\{\{([^}]+)\}\}/g)
      ?.map((tag) => tag.replace(/\{\{|\}\}/g, '').trim()) || [];

    const xmlContent = Object.values(zip.files)
      .filter((f) => f.name.endsWith('.xml'))
      .map((f) => f.asText())
      .join('');

    const xmlTags = (xmlContent.match(/\{\{([^}]+)\}\}/g) || [])
      .map((tag) => tag.replace(/\{\{|\}\}/g, '').trim());

    const allTags = [...new Set([...tags, ...xmlTags])];

    return allTags.map((tag) => ({
      name: `{{${tag}}}`,
      path: tag,
      isValid: tag in KNOWN_VARIABLES,
      description: KNOWN_VARIABLES[tag],
    }));
  }

  /**
   * Extract all {{variable}} placeholders from HTML content
   */
  extractVariablesFromHtml(html: string): VariableInfo[] {
    const matches = html.match(/\{\{([^}]+)\}\}/g) || [];
    const tags = [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];

    return tags.map((tag) => ({
      name: `{{${tag}}}`,
      path: tag,
      isValid: tag in KNOWN_VARIABLES,
      description: KNOWN_VARIABLES[tag],
    }));
  }

  /**
   * Render DOCX template with variable substitution
   */
  async renderDocx(
    templateBuffer: Buffer,
    variables: Record<string, string>,
  ): Promise<Buffer> {
    const zip = new PizZip(templateBuffer);

    // Flatten nested variable object into dot notation keys
    const flatVars = this.flattenVariables(variables);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: (part) => {
        this.logger.warn(`Undefined variable: ${part.value}`);
        return '';
      },
    });

    doc.render(flatVars);

    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  /**
   * Render HTML template with Handlebars
   */
  renderHtml(htmlTemplate: string, variables: Record<string, string>): string {
    // Register date helpers
    Handlebars.registerHelper('now', () => new Date().toLocaleDateString('pt-BR'));
    Handlebars.registerHelper('formatDate', (date: string) =>
      date ? new Date(date).toLocaleDateString('pt-BR') : '',
    );

    const compiled = Handlebars.compile(htmlTemplate, { noEscape: true });
    const flatVars = this.flattenVariables(variables);

    // Build nested object for Handlebars
    const context = this.buildNestedObject(flatVars);
    return compiled(context);
  }

  /**
   * Compute calculated variables from base employee variables
   * These are derived at render time — not stored in DB
   */
  computeCalculatedVariables(baseVars: Record<string, string>): Record<string, string> {
    const calculated: Record<string, string> = {};

    // Fim do período de experiência (admissão + 90 dias)
    const admissao = baseVars['funcionario.data_admissao'];
    if (admissao) {
      try {
        // Parse Brazilian date format dd/mm/yyyy
        const parts = admissao.split('/');
        const admDate = new Date(
          parseInt(parts[2]),
          parseInt(parts[1]) - 1,
          parseInt(parts[0]),
        );

        calculated['funcionario.fim_experiencia'] = format(
          addDays(admDate, 90),
          'dd/MM/yyyy',
        );
        calculated['funcionario.fim_experiencia_prorrogada'] = format(
          addDays(admDate, 180),
          'dd/MM/yyyy',
        );
        calculated['funcionario.anos_empresa'] = differenceInYears(
          new Date(),
          admDate,
        ).toString();
        calculated['funcionario.tempo_empresa'] = formatDistanceToNow(admDate, {
          locale: ptBR,
          addSuffix: false,
        });
      } catch {
        // Silently skip if date parsing fails
      }
    }

    // Idade calculada
    const dataNasc = baseVars['funcionario.data_nascimento'];
    if (dataNasc) {
      try {
        const parts = dataNasc.split('/');
        const birthDate = new Date(
          parseInt(parts[2]),
          parseInt(parts[1]) - 1,
          parseInt(parts[0]),
        );
        calculated['funcionario.idade'] = differenceInYears(new Date(), birthDate).toString();
      } catch {
        // Silently skip
      }
    }

    return calculated;
  }

  /**
   * Validate a variable path and add custom fields to registry dynamically
   */
  isValidVariable(path: string, customVarPaths: string[] = []): boolean {
    return path in KNOWN_VARIABLES || customVarPaths.includes(path);
  }

  /**
   * Get all available variables with descriptions
   * Accepts additional custom variables to merge into result
   */
  getAvailableVariables(customVars: VariableInfo[] = []): VariableInfo[] {
    const static_ = Object.entries(KNOWN_VARIABLES).map(([path, description]) => ({
      name: `{{${path}}}`,
      path,
      isValid: true,
      description,
      isCustom: false,
    }));
    return [...static_, ...customVars];
  }

  /**
   * Validate variables in a template against known + custom registries
   */
  validateVariables(
    variables: VariableInfo[],
    customVarPaths: string[] = [],
  ): { valid: VariableInfo[]; invalid: VariableInfo[] } {
    const allValid = new Set([
      ...Object.keys(KNOWN_VARIABLES),
      ...customVarPaths,
    ]);

    const resolved = variables.map((v) => ({
      ...v,
      isValid: allValid.has(v.path),
    }));

    return {
      valid: resolved.filter((v) => v.isValid),
      invalid: resolved.filter((v) => !v.isValid),
    };
  }

  private flattenVariables(
    obj: Record<string, any>,
    prefix = '',
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flattenVariables(value, fullKey));
      } else {
        result[fullKey] = String(value ?? '');
      }
    }
    return result;
  }

  private buildNestedObject(flat: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(flat)) {
      const parts = key.split('.');
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
    return result;
  }
}
