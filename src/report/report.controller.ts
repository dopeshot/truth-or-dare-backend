import { Controller } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { ReportService } from './report.service';

@Controller('report')
export class ReportController {
    constructor(private readonly reportService: ReportService) {}

    @Get('')
    @JwtAuthGuard()
    getAllReports() {
        return this.reportService.getAllReports();
    }
}
