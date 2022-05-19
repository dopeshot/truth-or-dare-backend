import { IsString, Length } from 'class-validator';

export class CreateReportDto {
    @IsString()
    @Length(0, 420)
    description: string;
}
