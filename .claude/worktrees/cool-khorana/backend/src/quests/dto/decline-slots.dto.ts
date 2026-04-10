import { IsString, IsNotEmpty } from 'class-validator';

export class DeclineSlotsDto {
  @IsString()
  @IsNotEmpty()
  questId: string;
}
