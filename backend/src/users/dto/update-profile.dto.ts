import { IsString, IsInt, IsOptional, Min, Max, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(80)
  age?: number;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'any'])
  prefGender?: string;

  @IsOptional()
  @IsInt()
  @Min(16)
  prefAgeMin?: number;

  @IsOptional()
  @IsInt()
  @Max(80)
  prefAgeMax?: number;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
