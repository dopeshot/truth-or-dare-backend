import {
    Injectable,
    InternalServerErrorException,
    NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { JwtUserDto } from '../auth/dto/jwt.dto';
import { SetService } from '../set/set.service';
import { Status } from '../shared/enums/status.enum';
import { CreateReportDto } from './dtos/create-report.dto';
import { UpdateReportDto } from './dtos/report-update.dto';
import { Report, ReportDocument } from './entities/report.entity';

@Injectable()
export class ReportService {
    constructor(
        @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
        private readonly setService: SetService
    ) {}

    async getAllReports(): Promise<ReportDocument[]> {
        return await this.reportModel.find().lean();
    }

    async initiateReportFlow(
        createReportDto: CreateReportDto,
        user: JwtUserDto | null
    ) {
        // Report is for a task within task
        if (createReportDto.taskId) {
            this.setService.updateTaskStatus(
                createReportDto.setId,
                createReportDto.taskId,
                Status.SUSPENDED
            );
        }
        // Report is for a set
        else {
            this.setService.updateSetStatus(
                createReportDto.setId,
                Status.SUSPENDED
            );
        }

        await this.createReport(createReportDto, user);
    }

    private async createReport(
        createReportDto: CreateReportDto,
        user: JwtUserDto | null
    ): Promise<void> {
        try {
            await this.reportModel.create({
                ...createReportDto,
                createdBy: user?.userId
            });
        } catch (error) {
            /* istanbul ignore next */ // Unable to test Internal server error here
            throw new InternalServerErrorException('Could not create Report');
        }
    }

    async updateReport(
        reportId: ObjectId,
        updateData: UpdateReportDto,
        user: JwtUserDto
    ): Promise<ReportDocument> {
        const report = await this.reportModel.findOneAndUpdate(
            {
                _id: reportId
            },
            updateData
        );

        if (!report) throw new NotFoundException();

        return report;
    }
}
