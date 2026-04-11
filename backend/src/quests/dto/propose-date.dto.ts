import { IsISO8601, IsBoolean, IsOptional } from 'class-validator';

export class ProposeDateDto {
  @IsISO8601({ strict: true }, { message: 'proposedDate должна быть валидной ISO 8601 датой' })
  proposedDate: string;
}

export class ConfirmDateDto {
  @IsBoolean()
  accept: boolean;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'counterDate должна быть валидной ISO 8601 датой' })
  counterDate?: string;
}
