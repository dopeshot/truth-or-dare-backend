import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId, SchemaTypes } from 'mongoose';
import { Set } from '../../set/entities/set.entity';
import { Task } from '../../set/entities/task.entity';
import { User } from '../../user/entities/user.entity';
import { ReportKind } from '../enums/report-kind.enum';
import { ReportStatus } from '../enums/report-status.enum';

@Schema({ timestamps: true, _id: true })
export class Report {
    @Prop({ type: SchemaTypes.ObjectId, ref: Set.name, required: true })
    set: Set;

    @Prop({ required: true })
    kind: ReportKind;

    @Prop({ type: SchemaTypes.ObjectId, ref: Task.name, required: true })
    task: Task;

    @Prop({ default: ReportStatus.NEW })
    status: ReportStatus | ReportStatus.NEW;

    @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
    createdBy: User;

    @Prop({ required: false })
    description: string;

    @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
    reviewedBy: ObjectId;

    @Prop({ required: false })
    reviewerNote: string;
}

export type ReportDocument = Report & Document;
export type ReportDocumentWithUser = ReportDocument & { createdBy?: User };
export const ReportSchema = SchemaFactory.createForClass(Report);
