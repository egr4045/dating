import { IsIn } from 'class-validator';

export class UpdateMatchStatusDto {
  @IsIn(['COMPLETED', 'FAILED'])
  status: 'COMPLETED' | 'FAILED';
}
