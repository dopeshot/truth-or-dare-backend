import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';
import { ObjectId } from 'mongoose';

export class CreateReportDto {
    @IsString()
    @Length(0, 420)
    description: string;

    @IsMongoId()
    set: ObjectId;

    @IsMongoId()
    @IsOptional()
    task: ObjectId;
}
