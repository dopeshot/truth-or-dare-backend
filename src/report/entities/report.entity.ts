import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId, SchemaTypes } from 'mongoose';
import { Set, SetSchema } from '../../set/entities/set.entity';
import { Task, TaskSchema } from '../../set/entities/task.entity';
import { User } from '../../user/entities/user.entity';
import { ReportStatus } from '../enums/report-status.enum';

@Schema({ timestamps: true, _id: true })
export class Report {
    @Prop({ required: true, type: SetSchema })
    set: Set;

    @Prop({ required: false, type: TaskSchema })
    tasks: Task;

    @Prop({ default: ReportStatus.RECEIVED })
    status: ReportStatus | ReportStatus.RECEIVED;

    @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
    createdBy: ObjectId;

    @Prop({ required: false })
    description: string;

    @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: false })
    reviewedBy: ObjectId;

    @Prop({ required: false })
    reviewerNote: string;
}

export type ReportDocument = Report & Document;
export type ReportDocumentWithUser = ReportDocument & { createdBy?: User };
export const ReportSchema = SchemaFactory.createForClass(Set);
