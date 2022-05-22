import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SetService } from '../set/set.service';
import { Report, ReportSchema } from './entities/report.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
    providers: [ReportService],
    controllers: [ReportController],
    imports: [
        MongooseModule.forFeature([
            { name: Report.name, schema: ReportSchema }
        ]),
        SetService
    ]
})
export class ReportModule {}
