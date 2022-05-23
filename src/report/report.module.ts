import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SetModule } from '../set/set.module';
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
        SetModule
    ]
})
export class ReportModule {}
