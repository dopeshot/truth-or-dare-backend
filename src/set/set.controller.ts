import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Request,
    SerializeOptions,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtUserDto } from 'src/auth/dto/jwt.dto';
import { Roles } from '../auth/roles/roles.decorator';
import { RolesGuard } from '../auth/roles/roles.guard';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { OptionalJWTGuard } from '../auth/strategies/optionalJWT/optionalJWT.guard';
import { LanguageDto } from '../shared/dto/lanugage.dto';
import { MongoIdDto } from '../shared/dto/mongoId.dto';
import { Role } from '../user/enums/role.enum';
import { CreateFullSetDto } from './dto/create-full-set.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { DeleteTypeDto } from './dto/delete-type.dto';
import { SetTaskMongoIdDto } from './dto/set-task-mongoid.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
    SetMetadataResponse,
    SetResponse,
    SetWithTasksResponse,
    TaskResponse,
    UpdatedCounts,
    UpdatedPlayed
} from './responses/set-response';
import { SetService } from './set.service';

@ApiTags('sets')
@Controller('sets')
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ strategy: 'excludeAll' })
export class SetController {
    constructor(private readonly setService: SetService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Create new set' })
    async createSet(
        @Body() createSetDto: CreateSetDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ): Promise<SetResponse> {
        return new SetResponse(
            await this.setService.createSet(createSetDto, user)
        );
    }

    @Get()
    @ApiOperation({ summary: 'Get all Sets' })
    async getAllSets(@Query() { lang }: LanguageDto): Promise<SetResponse[]> {
        return (await this.setService.getAllSets(lang)).map(
            (set) => new SetResponse(set)
        );
    }

    @Get('/user/:id')
    @UseGuards(OptionalJWTGuard)
    @ApiOperation({ summary: 'Get one Set by author id' })
    async getSetsFromUser(
        @Param() { id }: MongoIdDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ): Promise<SetResponse[]> {
        return (await this.setService.getSetsFromUser(id, user)).map(
            (set) => new SetResponse(set)
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get one Set by id' })
    @UseGuards(OptionalJWTGuard)
    async getOneSet(
        @Param() { id }: MongoIdDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ): Promise<SetWithTasksResponse> {
        return new SetWithTasksResponse(
            await this.setService.getOneSetForUserOrFail(id, user)
        );
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update Set by id' })
    async updateMeta(
        @Param() { id }: MongoIdDto,
        @Body() updateSetDto: UpdateSetDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ): Promise<SetMetadataResponse> {
        return new SetMetadataResponse(
            await this.setService.updateSetMetadataOrFail(
                id,
                updateSetDto,
                user
            )
        );
    }

    @Patch(':id/played')
    @ApiOperation({ summary: 'Update Set by id' })
    async updatePlayed(@Param() { id }: MongoIdDto): Promise<UpdatedPlayed> {
        return new UpdatedPlayed(
            await this.setService.updateSetPlayedOrFail(id)
        );
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete Set by id' })
    async deleteSet(
        @Param() { id }: MongoIdDto,
        @Query() { type }: DeleteTypeDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ) {
        return await this.setService.deleteSetOrFail(id, type, user);
    }

    // Tasks

    @Post(':id/task')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Create Task to Set via id and Json' })
    async createTask(
        @Param() { id }: MongoIdDto,
        @Body() createTaskDto: CreateTaskDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ): Promise<TaskResponse> {
        return new TaskResponse(
            await this.setService.createTask(id, createTaskDto, user)
        );
    }

    @Put(':setId/task/:taskId')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update one Task via id and Json' })
    async updateTask(
        @Param() { setId, taskId }: SetTaskMongoIdDto,
        @Body() updateTaskDto: UpdateTaskDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ): Promise<UpdatedCounts> {
        return new UpdatedCounts(
            await this.setService.updateTaskOrFail(
                setId,
                taskId,
                updateTaskDto,
                user
            )
        );
    }

    @Delete(':setId/task/:taskId')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove one Task via id' })
    async removeTask(
        @Param() { setId, taskId }: SetTaskMongoIdDto,
        @Query() { type }: DeleteTypeDto,
        @Request() { user }: ParameterDecorator & { user: JwtUserDto }
    ) {
        return await this.setService.removeTaskOrFail(
            setId,
            taskId,
            type,
            user
        );
    }

    @Post('createfullset')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Create example data sets' })
    async createDataFromFullSet(
        @Request() { user }: ParameterDecorator & { user: JwtUserDto },
        @Body() fullSet: CreateFullSetDto
    ): Promise<SetWithTasksResponse> {
        return new SetWithTasksResponse(
            await this.setService.createDataFromFullSet(user, fullSet)
        );
    }

    // Admin endpoints

    @Get(':setId/task/:taskId')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    async getOneTask(@Param() { setId, taskId }: SetTaskMongoIdDto) {
        return new TaskResponse(
            await this.setService.getOneTaskOrFail(setId, taskId)
        );
    }
}
