import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsBoolean, IsOptional, IsInt, IsArray, Min, MaxLength,
  Matches,
} from 'class-validator';
import { CustomFieldType } from '@prisma/client';

export class CreateCustomFieldDto {
  @ApiProperty({
    example: 'numero_calcado',
    description: 'Slug único (sem espaços). Será a variável: {{custom.numero_calcado}}',
  })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'name deve conter apenas letras minúsculas, números e underscore',
  })
  name: string;

  @ApiProperty({ example: 'Número do Calçado' })
  @IsString()
  @MaxLength(150)
  label: string;

  @ApiProperty({ enum: CustomFieldType, default: CustomFieldType.TEXT })
  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @ApiPropertyOptional({
    description: 'Opções para tipo SELECT',
    example: ['P', 'M', 'G', 'GG'],
  })
  @IsOptional()
  @IsArray()
  options?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class SetCustomFieldValueDto {
  @ApiProperty()
  @IsString()
  customFieldId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  value: string;
}

export class BulkSetCustomFieldValuesDto {
  @ApiProperty({ type: [SetCustomFieldValueDto] })
  values: SetCustomFieldValueDto[];
}
