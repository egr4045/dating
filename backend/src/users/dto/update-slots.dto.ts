import { IsArray, IsInt, IsNotEmpty, IsString, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TimeSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number; // 0=Пн, 1=Вт, ... 6=Вс

  @IsString()
  @IsNotEmpty()
  timeFrom: string;  // "19:00"

  @IsString()
  @IsNotEmpty()
  timeTo: string;    // "22:00"
}

export class UpdateSlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  slots: TimeSlotDto[];
}
