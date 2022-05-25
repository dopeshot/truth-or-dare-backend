import {
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, Types } from 'mongoose';
import { JwtUserDto } from '../auth/dto/jwt.dto';
import { Language } from '../shared/enums/language.enum';
import { Status } from '../shared/enums/status.enum';
import { createSlug } from '../shared/global-functions/create-slug';
import { User } from '../user/entities/user.entity';
import { Role } from '../user/enums/role.enum';
import { CreateFullSetDto } from './dto/create-full-set.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Set, SetDocument, SetDocumentWithUser } from './entities/set.entity';
import { Task, TaskDocument } from './entities/task.entity';
import { DeleteType } from './enums/delete-type.enum';
import { TaskType } from './enums/tasktype.enum';
import { Visibility } from './enums/visibility.enum';

@Injectable()
export class SetService {
    constructor(
        @InjectModel(Set.name) private setModel: Model<SetDocument>,
        @InjectModel(Task.name) private taskModel: Model<TaskDocument>
    ) {}

    async createSet(
        createSetDto: CreateSetDto,
        user: JwtUserDto
    ): Promise<SetDocumentWithUser> {
        try {
            const set = await this.setModel.create({
                ...createSetDto,
                slug: createSlug(createSetDto.name),
                createdBy: user.userId
            });

            // Since populate is used, the database is queried again
            return await this.setModel
                .findById(set._id)
                .populate<{ createdBy: User }>('createdBy')
                .lean();
        } catch (error) {
            /* istanbul ignore next */ // Unable to test Internal server error here
            throw new InternalServerErrorException();
        }
    }

    async getAllSets(language: Language): Promise<SetDocumentWithUser[]> {
        const matchQuery: {
            status: Status;
            visibility: Visibility;
            language?: Language;
        } = {
            status: Status.ACTIVE,
            visibility: Visibility.PUBLIC
        };
        if (language) matchQuery.language = language;
        return await this.setModel
            .find(matchQuery)
            .populate<{ createdBy: User }>('createdBy')
            .lean();
    }

    async getSetsFromUser(
        userId: ObjectId,
        user: JwtUserDto
    ): Promise<SetDocumentWithUser[]> {
        // The standard query
        const queryMatch: {
            status: Status;
            createdBy: ObjectId;
            visibility?: Visibility;
        } = { status: Status.ACTIVE, createdBy: userId };

        // Requesting others sets
        if (!user || (userId !== user.userId && user.role !== Role.ADMIN)) {
            // Only admins and owners can see others private sets
            queryMatch.visibility = Visibility.PUBLIC;
        }

        const sets: SetDocumentWithUser[] = await this.setModel
            .find(queryMatch)
            .populate<{ createdBy: User }>('createdBy')
            .lean();

        // TODO: extract this function if needed later on as well
        if (!user || user.role !== Role.ADMIN) {
            sets.forEach((set) => {
                set.tasks = set.tasks.filter(
                    (task) => task.status === Status.ACTIVE
                );
            });
        }

        return sets;
    }

    async getOneSet(
        id: ObjectId,
        user: JwtUserDto
    ): Promise<SetDocumentWithUser> {
        const set: SetDocumentWithUser = await this.setModel
            .findOne({
                _id: id,
                status: Status.ACTIVE
            })

            .populate<{ createdBy: User }>('createdBy')
            .lean();

        // Only Admins and Owners can see the private sets
        if (
            // No Set at all
            !set ||
            // Set is private => check further
            (set.visibility === Visibility.PRIVATE &&
                // No Authentification
                (!user ||
                    // No Admin
                    (user.role !== Role.ADMIN &&
                        // No User in Database (deleted for example)
                        (!set.createdBy ||
                            // Not the correct user
                            set.createdBy._id.toString() !==
                                user.userId.toString()))))
        )
            throw new NotFoundException();

        // Admins can see unfiltered sets
        if (user.role !== Role.ADMIN) {
            // Remove tasks from array that are not active
            set.tasks = set.tasks.filter(
                (task) => task.status === Status.ACTIVE
            );
        }
        return set;
    }

    async updateSetMetadata(
        id: ObjectId,
        updateSetDto: UpdateSetDto,
        user: JwtUserDto
    ): Promise<SetDocument> {
        const queryMatch: { _id: ObjectId; createdBy?: ObjectId } = { _id: id };

        if (user.role !== Role.ADMIN) queryMatch.createdBy = user.userId;

        if (updateSetDto.name) {
            updateSetDto.slug = createSlug(updateSetDto.name);
        }

        const set: SetDocument = await this.setModel
            .findOneAndUpdate(queryMatch, updateSetDto, {
                new: true
            })
            .lean();

        if (!set) throw new NotFoundException();

        return set;
    }

    // Update Set Status - only used by report
    async updateSetStatus(setId: ObjectId, newStatus: Status): Promise<void> {
        const set: SetDocument = await this.setModel.findOneAndUpdate(
            {
                _id: setId
            },
            {
                status: newStatus
            }
        );

        if (!set) {
            throw new NotFoundException();
        }
    }

    async updateSetPlayed(id: ObjectId): Promise<SetDocument> {
        const set: SetDocument = await this.setModel
            .findByIdAndUpdate(
                id,
                {
                    $inc: { played: 1 }
                },
                { new: true }
            )
            .lean();

        if (!set) throw new NotFoundException();

        return set;
    }

    async deleteSet(
        id: ObjectId,
        deleteType: DeleteType,
        user: JwtUserDto
    ): Promise<void> {
        // Hard delete
        if (deleteType === DeleteType.HARD) {
            if (user.role !== Role.ADMIN) throw new ForbiddenException();

            const set: SetDocument = await this.setModel.findByIdAndDelete(id);

            if (!set) throw new NotFoundException();

            return;
        }

        // Soft delete
        const queryMatch: { _id: ObjectId; createdBy?: ObjectId } = { _id: id };

        if (user.role !== Role.ADMIN) queryMatch.createdBy = user.userId;

        const set: SetDocument = await this.setModel.findOneAndUpdate(
            queryMatch,
            {
                status: Status.DELETED
            }
        );

        if (!set) throw new NotFoundException();

        return;
    }

    // Tasks

    async getOneTask(setId: ObjectId, taskId: ObjectId): Promise<TaskDocument>{
        const task = ((await this.setModel.findOne({_id: setId})).tasks as TaskDocument[])
        .find(task => task._id.toString() === taskId)
        if (!task){
            throw new NotFoundException()
        }   
        return task
    }

    async createTask(
        setId: ObjectId,
        createTaskDto: CreateTaskDto,
        user: JwtUserDto
    ): Promise<Partial<TaskDocument>> {
        const task: Partial<TaskDocument> = new this.taskModel({
            ...createTaskDto,
            slug: createSlug(createTaskDto.message)
        }).toObject();

        const queryMatch: { _id: ObjectId; createdBy?: ObjectId } = {
            _id: setId
        };

        if (user.role !== Role.ADMIN) queryMatch.createdBy = user.userId;

        const incrementType =
            createTaskDto.type === TaskType.TRUTH
                ? { $push: { tasks: task }, $inc: { truthCount: 1 } }
                : { $push: { tasks: task }, $inc: { dareCount: 1 } };

        const set: SetDocument = await this.setModel.findOneAndUpdate(
            queryMatch,
            incrementType,
            { new: true }
        );

        if (!set) throw new NotFoundException();

        return task;
    }

    // The frontend should always send all 3 updatable properties
    async updateTask(
        setId: ObjectId,
        taskId: ObjectId,
        updateTaskDto: UpdateTaskDto,
        user: JwtUserDto
    ): Promise<SetDocument> {
        const queryMatch: {
            _id: ObjectId;
            'tasks._id': ObjectId;
            createdBy?: ObjectId;
        } = { _id: setId, 'tasks._id': taskId };
        if (user.role !== Role.ADMIN) queryMatch.createdBy = user.userId;

        const queryUpdate = {
            'tasks.$.type': updateTaskDto.type,
            'tasks.$.message': updateTaskDto.message,
            'tasks.$.currentPlayerGender': updateTaskDto.currentPlayerGender,
            'tasks.$.slug': createSlug(updateTaskDto.message)
        };

        const set: SetDocument = await this.setModel.findOneAndUpdate(
            queryMatch,
            queryUpdate,
            { new: true }
        );

        if (!set) throw new NotFoundException();

        const updatedResult: SetDocument = await this.updateCounts(setId);

        return updatedResult;
    }

    // Update Task Status - only used by report feature
    async updateTaskStatus(
        setId: ObjectId,
        taskId: ObjectId,
        newStatus: Status
    ): Promise<void> {
        const set: SetDocument = await this.setModel.findOneAndUpdate(
            {
                _id: setId,
                'tasks._id': taskId
            },
            {
                'tasks.$.status': newStatus
            }
        );

        if (!set) {
            throw new NotFoundException();
        }
    }

    async removeTask(
        setId: ObjectId,
        taskId: ObjectId,
        deleteType: DeleteType,
        user: JwtUserDto
    ): Promise<SetDocument> {
        // Hard delete
        if (deleteType === DeleteType.HARD) {
            if (user.role !== Role.ADMIN) throw new ForbiddenException();

            const set: SetDocument = await this.setModel.findOneAndUpdate(
                { _id: setId, 'tasks._id': taskId },
                { $pull: { tasks: { _id: taskId } } }
            );

            if (!set) {
                throw new NotFoundException();
            }

            const updatedResult: SetDocument = await this.updateCounts(setId);

            return updatedResult;
        }

        // Soft delete
        const queryMatch: {
            _id: ObjectId;
            'tasks._id': ObjectId;
            createdBy?: ObjectId;
        } = { _id: setId, 'tasks._id': taskId };
        if (user.role !== Role.ADMIN) queryMatch.createdBy = user.userId;

        const set: SetDocument = await this.setModel.findOneAndUpdate(
            queryMatch,
            {
                'tasks.$.status': Status.DELETED
            }
        );

        if (!set) throw new NotFoundException();

        const updatedResult: SetDocument = await this.updateCounts(setId);

        return updatedResult;
    }

    // Helpers

    // Uses 2 additional database calls to update the task counts and return the new settings
    private async updateCounts(setId: ObjectId): Promise<SetDocument> {
        // Recounts the active truths and dares, projects the new counts and merges them back into the existing document
        /*
        1. matches the desired set via id
        2. Sets the field dareCount by getting the size of the array filtered from tasks being active and have the type dare
        3. Does the same for truthCount
        4. Projects only the desired fields dareCount truthCount and id
        5. Merges the aggregation pipeline result back into the sets collection on the set matching the _id
        */
        await this.setModel.aggregate([
            {
                $match: {
                    _id: new Types.ObjectId(setId.toString())
                }
            },
            {
                $set: {
                    dareCount: {
                        $size: {
                            $filter: {
                                input: '$tasks',
                                as: 'a',
                                cond: {
                                    $and: [
                                        {
                                            $eq: ['$$a.type', 'dare']
                                        },
                                        {
                                            $eq: ['$$a.status', 'active']
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    truthCount: {
                        $size: {
                            $filter: {
                                input: '$tasks',
                                as: 'a',
                                cond: {
                                    $and: [
                                        {
                                            $eq: ['$$a.type', 'truth']
                                        },
                                        {
                                            $eq: ['$$a.status', 'active']
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            {
                $project: { _id: 1, truthCount: 1, dareCount: 1 }
            },
            {
                $merge: {
                    into: 'sets',
                    on: '_id',
                    whenMatched: 'merge',
                    whenNotMatched: 'discard'
                }
            }
        ]);

        // Since the aggregation has no return value, We have to make another call to get the updated data
        const set: SetDocument = await this.setModel.findById(setId).lean();

        /* istanbul ignore next */ // Unable to test Internal server error here
        if (!set) throw new InternalServerErrorException();

        return set;
    }

    async createDataFromFullSet(
        user: JwtUserDto,
        sampleSets: CreateFullSetDto
    ): Promise<SetDocumentWithUser> {
        if (user.role !== Role.ADMIN) throw new ForbiddenException();

        const { tasks, ...createSetDto } = sampleSets;
        // Exceptions are caught in the function calls
        const set = await this.createSet(createSetDto, user);
        tasks.forEach(async (task) => {
            await this.createTask(set._id, task, user);
        });

        return await this.getOneSet(set._id, user);
    }
}
