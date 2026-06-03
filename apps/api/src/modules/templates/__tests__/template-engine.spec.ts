import { Test, TestingModule } from '@nestjs/testing';
import { TemplateEngineService } from '../engines/template-engine.service';

describe('TemplateEngineService', () => {
  let service: TemplateEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TemplateEngineService],
    }).compile();

    service = module.get<TemplateEngineService>(TemplateEngineService);
  });

  describe('extractVariablesFromHtml', () => {
    it('should extract all variables from HTML template', () => {
      const html = `
        <p>Nome: {{funcionario.nome}}</p>
        <p>CPF: {{funcionario.cpf}}</p>
        <p>Empresa: {{empresa.nome}}</p>
        <p>Data: {{data.hoje}}</p>
      `;

      const vars = service.extractVariablesFromHtml(html);

      expect(vars).toHaveLength(4);
      expect(vars.map((v) => v.path)).toContain('funcionario.nome');
      expect(vars.map((v) => v.path)).toContain('funcionario.cpf');
      expect(vars.map((v) => v.path)).toContain('empresa.nome');
      expect(vars.map((v) => v.path)).toContain('data.hoje');
    });

    it('should deduplicate repeated variables', () => {
      const html = `{{funcionario.nome}} e {{funcionario.nome}} novamente`;
      const vars = service.extractVariablesFromHtml(html);
      expect(vars).toHaveLength(1);
    });

    it('should mark unknown variables as invalid', () => {
      const html = `{{funcionario.nome}} {{variavel.inexistente}}`;
      const vars = service.extractVariablesFromHtml(html);
      const valid = vars.find((v) => v.path === 'funcionario.nome');
      const invalid = vars.find((v) => v.path === 'variavel.inexistente');

      expect(valid?.isValid).toBe(true);
      expect(invalid?.isValid).toBe(false);
    });

    it('should return empty array for template without variables', () => {
      const html = '<p>Documento sem variáveis</p>';
      const vars = service.extractVariablesFromHtml(html);
      expect(vars).toHaveLength(0);
    });
  });

  describe('renderHtml', () => {
    it('should substitute all variables correctly', () => {
      const html = '<p>{{funcionario.nome}} - {{funcionario.cpf}}</p>';
      const variables = {
        'funcionario.nome': 'João da Silva',
        'funcionario.cpf': '123.456.789-09',
      };

      const result = service.renderHtml(html, variables);

      expect(result).toContain('João da Silva');
      expect(result).toContain('123.456.789-09');
      expect(result).not.toContain('{{funcionario.nome}}');
    });

    it('should handle nested dot notation variables', () => {
      const html = '<p>{{funcionario.nome}} de {{empresa.nome}}</p>';
      const variables = {
        'funcionario.nome': 'Maria Santos',
        'empresa.nome': 'SC Office Ltda',
      };

      const result = service.renderHtml(html, variables);
      expect(result).toContain('Maria Santos');
      expect(result).toContain('SC Office Ltda');
    });
  });

  describe('validateVariables', () => {
    it('should correctly separate valid and invalid variables', () => {
      const variables = [
        { name: '{{funcionario.nome}}', path: 'funcionario.nome', isValid: true },
        { name: '{{variavel.custom}}', path: 'variavel.custom', isValid: false },
        { name: '{{empresa.cnpj}}', path: 'empresa.cnpj', isValid: true },
      ];

      const { valid, invalid } = service.validateVariables(variables);

      expect(valid).toHaveLength(2);
      expect(invalid).toHaveLength(1);
      expect(invalid[0].path).toBe('variavel.custom');
    });
  });

  describe('getAvailableVariables', () => {
    it('should return all known variables', () => {
      const vars = service.getAvailableVariables();

      expect(vars.length).toBeGreaterThan(20);
      expect(vars.every((v) => v.isValid)).toBe(true);
      expect(vars.every((v) => v.name.startsWith('{{'))).toBe(true);
      expect(vars.every((v) => v.name.endsWith('}}}') === false)).toBe(true);
    });
  });
});
