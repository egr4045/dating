import { IsInt, IsNotEmpty, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TimeSlotDto } from '../../users/dto/update-slots.dto';

export class ConfirmSlotDto {
  @IsInt()
  @IsNotEmpty()
  lobbyId: number;

  @IsObject()
  @ValidateNested()
  @Type(() => TimeSlotDto)
  selectedSlot: TimeSlotDto;
}
