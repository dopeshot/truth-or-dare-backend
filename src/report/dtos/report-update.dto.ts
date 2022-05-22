import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '../enums/report-status.enum';

// Does not extend create dto as admin should not be able to alter the contents of a report
export class UpdateReportDto {
    @IsOptional()
    status: ReportStatus;

    @IsString()
    @IsOptional()
    @MaxLength(512)
    reviewerNote: string;
}
