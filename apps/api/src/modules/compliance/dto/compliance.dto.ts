import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsBoolean, IsOptional, IsString, IsInt, IsDateString, Min,
} from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateRequirementDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ example: 'Carteira de Trabalho e Previdência Social' })
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Bloqueia geração se ausente' })
  @IsOptional()
  @IsBoolean()
  blockGeneration?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class BulkRequirementsDto {
  @ApiProperty({ type: [CreateRequirementDto] })
  requirements: CreateRequirementDto[];
}

export class SetValidityDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
