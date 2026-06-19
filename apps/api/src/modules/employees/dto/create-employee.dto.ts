import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsDateString,
  IsEnum,
  IsOptional,
  IsDecimal,
  Matches,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { EmployeeStatus, Gender, MaritalStatus } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateEmployeeDto {
  // Dados Pessoais
  @ApiProperty({ example: 'João da Silva Santos' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional({ example: 'João Santos' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  socialName?: string;

  @ApiProperty({ example: '123.456.789-09' })
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: 'CPF deve estar no formato 999.999.999-99' })
  cpf: string;

  @ApiPropertyOptional({ example: '12.345.678-9' })
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rgIssuingBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rgState?: string;

  @ApiProperty({ example: '1990-06-15' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ enum: Gender, default: Gender.NAO_INFORMADO })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ enum: MaritalStatus, default: MaritalStatus.SOLTEIRO })
  @IsEnum(MaritalStatus)
  maritalStatus: MaritalStatus;

  @ApiPropertyOptional({ default: 'Brasileiro(a)' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthState?: string;

  // Contato
  @ApiProperty({ example: 'joao.silva@email.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiPropertyOptional({ example: '(48) 3333-4444' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '(48) 99999-8888' })
  @IsOptional()
  @IsString()
  cellphone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  // Endereço
  @ApiPropertyOptional({ example: '88010-000' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}-\d{3}$/, { message: 'CEP deve estar no formato 99999-999' })
  zipCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  // Dados Profissionais
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  positionId: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  admissionDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDecimal()
  @Transform(({ value }) => value?.toString())
  salary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workSchedule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;

  // Dados bancários
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAgency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankPix?: string;

  // PIS/PASEP e CTPS
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctps?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctpsSerie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctpsState?: string;

  // Dados complementares de admissao
  @ApiPropertyOptional() @IsOptional() @IsString()
  educationLevel?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  race?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  bloodType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  children?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  uniformShirt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  uniformTShirt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  uniformPants?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  uniformJacket?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  uniformCoat?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  bootSize?: string;
}

export class UpdateEmployeeDto extends CreateEmployeeDto {
  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  terminationDate?: string;
}

export class EmployeeFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  positionId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ default: 'fullName' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'fullName';

  @ApiPropertyOptional({ default: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}
