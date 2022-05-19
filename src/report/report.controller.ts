import {
    Body,
    Controller,
    Get,
    Post,
    Request,
    UseGuards
} from '@nestjs/common';
import { JwtUserDto } from '../auth/dto/jwt.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { OptionalJWTGuard } from '../auth/strategies/optionalJWT/optionalJWT.guard';
import { CreateReportDto } from './dtos/report-create.dto';
import { ReportService } from './report.service';

@Controller('report')
export class ReportController {
    constructor(private readonly reportService: ReportService) {}

    @Get('')
    @UseGuards(JwtAuthGuard)
    async getAllReports() {
        return await this.reportService.getAllReports();
    }

    @Post('')
    @UseGuards(OptionalJWTGuard)
    async createNewReport(
        @Body() createReportDto: CreateReportDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ) {
        return await this.reportService.createReport(createReportDto, user);
    }
}
