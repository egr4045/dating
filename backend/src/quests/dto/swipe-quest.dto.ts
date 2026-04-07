import { IsString, IsIn, IsNotEmpty } from 'class-validator';

export class SwipeQuestDto {
  @IsString()
  @IsNotEmpty()
  questId: string;

  @IsIn(['like', 'dislike'])
  action: 'like' | 'dislike';
}
