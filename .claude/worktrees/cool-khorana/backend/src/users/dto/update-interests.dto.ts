import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class UpdateInterestsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  interests: string[];
}
