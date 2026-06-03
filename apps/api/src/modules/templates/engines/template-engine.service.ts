import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as Docxtemplater from 'docxtemplater';
import * as PizZip from 'pizzip';
import * as Handlebars from 'handlebars';

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

// Registry of all known variables
const KNOWN_VARIABLES: Record<string, string> = {
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
   * Get all available variables with descriptions
   */
  getAvailableVariables(): VariableInfo[] {
    return Object.entries(KNOWN_VARIABLES).map(([path, description]) => ({
      name: `{{${path}}}`,
      path,
      isValid: true,
      description,
    }));
  }

  /**
   * Validate variables in a template
   */
  validateVariables(variables: VariableInfo[]): {
    valid: VariableInfo[];
    invalid: VariableInfo[];
  } {
    return {
      valid: variables.filter((v) => v.isValid),
      invalid: variables.filter((v) => !v.isValid),
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
