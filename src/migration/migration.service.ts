import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtUserDto } from '../auth/dto/jwt.dto';
import { SetDocument } from '../set/entities/set.entity';
import { CurrentPlayerGender } from '../set/enums/currentplayergender.enum';
import { SetCategory } from '../set/enums/setcategory.enum';
import { TaskType } from '../set/enums/tasktype.enum';
import { Visibility } from '../set/enums/visibility.enum';
import { SetService } from '../set/set.service';
import { Language } from '../shared/enums/language.enum';
import { User, UserDocument } from '../user/entities/user.entity';
import { Role } from '../user/enums/role.enum';
import { UserService } from '../user/user.service';
import { MigrationDto } from './dto/migration.dto';
import { MigrateSets } from './migration-data/sets';
import { MigrateUsers } from './migration-data/users';

@Injectable()
export class MigrationService {
    constructor(
        @InjectModel(Set.name) private setModel: Model<SetDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly setService: SetService,
        private readonly userService: UserService
    ) {}

    async import(user: JwtUserDto, importData: MigrationDto) {
        if (user.role !== Role.ADMIN) throw new ForbiddenException();
        const counts = { setDuplicates: 0, userDuplicates: 0 };
        try {
            await this.setModel.insertMany(importData.sets, { ordered: false });
        } catch (error) {
            if (error.code === 11000) {
                counts.setDuplicates++;
            } else {
                /* istanbul ignore next */ // Not able to test server errors
                throw error;
            }
        }
        try {
            await this.userModel.insertMany(importData.users, {
                ordered: false
            });
        } catch (error) {
            if (error.code === 11000) {
                counts.userDuplicates++;
            } else {
                /* istanbul ignore next */ // Not able to test server errors
                throw error;
            }
        }
        return counts;
    }

    async export(user) {
        if (user.role !== Role.ADMIN) {
            throw new ForbiddenException();
        }
        const sets = await this.setModel.find().lean();
        const users = await this.userModel.find().lean();
        return { sets: sets, users: users };
    }

    /* istanbul ignore next */ // This is development only
    async importSamples(user: JwtUserDto) {
        MigrateSets.forEach(async (setData) => {
            try {
                const set: SetDocument = await this.setService.createSet(
                    {
                        name: setData.name,
                        language: setData.language as Language,
                        category: setData.category as SetCategory,
                        visibility: setData.visibility as Visibility
                    },
                    user
                );

                setData.tasks.forEach(async (task) => {
                    await this.setService.createTask(
                        set._id,
                        {
                            type: task.type as TaskType,
                            currentPlayerGender:
                                task.currentPlayerGender as CurrentPlayerGender,
                            message: task.message
                        },
                        user
                    );
                });
            } catch (error) {
                if (error.code === 11000) {
                    console.warn('Duplicate in seeder');
                } else {
                    /* istanbul ignore next */ // Not able to test server errors
                    throw error;
                }
            }
        });

        MigrateUsers.forEach(async (userData) => {
            try {
                await this.userService.create({
                    username: userData.username,
                    email: userData.email,
                    password: userData.password
                });
            } catch (error) {
                if (error.response.statusCode === 409) {
                    console.warn('Duplicate in seeder');
                } else {
                    /* istanbul ignore next */ // Not able to test server errors
                    throw error;
                }
            }
        });

        return;
    }
}
