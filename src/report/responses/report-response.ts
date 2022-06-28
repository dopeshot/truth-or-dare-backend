import { Expose, Transform, Type } from 'class-transformer';
import { ReportKind } from '../enums/report-kind.enum';
import { ReportStatus } from '../enums/report-status.enum';
import { SetResponse, TaskResponse } from './../../set/responses/set-response';
import { UserResponse } from './../../user/responses/user-response';
import { ReportDocument } from './../entities/report.entity';

export class ReportResponse {
    @Expose()
    @Transform((params) => params.obj._id.toString())
    _id: string;

    @Expose()
    @Type(() => SetResponse)
    set: SetResponse;

    @Expose()
    kind: ReportKind;

    @Expose()
    @Type(() => TaskResponse)
    task?: TaskResponse;

    @Expose()
    status: ReportStatus | ReportStatus.NEW;

    @Expose()
    @Type(() => UserResponse)
    createdBy?: UserResponse;

    @Expose()
    description?: string;

    @Expose()
    @Type(() => UserResponse)
    reviewedBy?: UserResponse;

    @Expose()
    reviewerNote?: string;

    constructor(obj: Partial<ReportDocument>) {
        console.log('transforming', obj);
        Object.assign(this, obj);
    }
}
