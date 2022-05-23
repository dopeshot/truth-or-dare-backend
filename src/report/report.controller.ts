import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Request,
    UseGuards
} from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { JwtUserDto } from '../auth/dto/jwt.dto';
import { Roles } from '../auth/roles/roles.decorator';
import { RolesGuard } from '../auth/roles/roles.guard';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { OptionalJWTGuard } from '../auth/strategies/optionalJWT/optionalJWT.guard';
import { Role } from '../user/enums/role.enum';
import { CreateReportDto } from './dtos/create-report.dto';
import { UpdateReportDto } from './dtos/report-update.dto';
import { ReportDocument } from './entities/report.entity';
import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
    constructor(private readonly reportService: ReportService) {}

    @Get('')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    async getAllReports(
        @Query('includeStatus') includedStatus: string
    ): Promise<ReportDocument[]> {
        return await this.reportService.getAllReports(
            includedStatus?.split(',')
        );
    }

    @Post('')
    @UseGuards(OptionalJWTGuard)
    async createNewReport(
        @Body() createReportDto: CreateReportDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ): Promise<void> {
        await this.reportService.initiateReportFlow(createReportDto, user);
    }

    @Patch(':reportId')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    async updateReport(
        @Param('reportId') reportId: ObjectId,
        @Body() updateReportDto: UpdateReportDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ): Promise<ReportDocument> {
        return await this.reportService.updateReport(
            reportId,
            updateReportDto,
            user
        );
    }
}
