import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { CurrentPlayerGender } from '../enums/currentplayergender.enum';
import { TaskType } from '../enums/tasktype.enum';

export class CreateTaskDto {
    @IsEnum(TaskType)
    type: TaskType;

    @IsEnum(CurrentPlayerGender)
    currentPlayerGender: CurrentPlayerGender = CurrentPlayerGender.ANYONE;

    @IsString()
    @Length(10, 280)
    message: string;
}
