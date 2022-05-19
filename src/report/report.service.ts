import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtUserDto } from '../auth/dto/jwt.dto';
import { CreateReportDto } from './dtos/report-create.dto';
import { Report, ReportDocument } from './entities/report.entity';

@Injectable()
export class ReportService {
    constructor(
        @InjectModel(Report.name) private reportModel: Model<ReportDocument>
    ) {}

    async getAllReports() {
        return await this.reportModel.find();
    }

    async createReport(
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
}
